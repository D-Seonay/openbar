import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: { user: Record<string, jest.Mock> };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [UsersService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(UsersService);
  });

  it('hashes the password before storing the user', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({
        id: '1',
        username: data.username,
        role: data.role,
        vip: data.vip,
        createdAt: new Date(),
      }),
    );

    await service.create({ username: 'noa', password: 'secret123' });

    const createArgs = prisma.user.create.mock.calls[0][0];
    expect(createArgs.data.passwordHash).not.toBe('secret123');
    expect(createArgs.data.passwordHash.length).toBeGreaterThan(20);
  });

  it('rejects creating a user with a username that already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.create({ username: 'noa', password: 'secret123' }),
    ).rejects.toThrow(ConflictException);
  });

  it('throws a ConflictException when deleting a user with associated contributions', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    prisma.user.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        'Foreign key constraint failed',
        {
          code: 'P2003',
          clientVersion: '5.0.0',
        },
      ),
    );

    await expect(service.remove('existing')).rejects.toThrow(ConflictException);
  });

  it('hashes a new password when updating a user with one', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: '1', username: 'noa' });
    prisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({
        id: '1',
        username: 'noa',
        role: 'USER',
        vip: false,
        createdAt: new Date(),
        ...data,
      }),
    );

    await service.update('1', { password: 'newsecret123' });

    const updateArgs = prisma.user.update.mock.calls[0][0];
    expect(updateArgs.data.password).toBeUndefined();
    expect(updateArgs.data.passwordHash).toBeDefined();
    expect(updateArgs.data.passwordHash).not.toBe('newsecret123');
  });

  it('searches users by partial, case-insensitive username match', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: '1', username: 'noah' }]);

    const result = await service.search('noa');

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { username: { contains: 'noa', mode: 'insensitive' } },
      select: { id: true, username: true },
      orderBy: { username: 'asc' },
      take: 10,
    });
    expect(result).toEqual([{ id: '1', username: 'noah' }]);
  });

  it('returns an empty array for an empty or whitespace-only query without hitting the database', async () => {
    await expect(service.search('')).resolves.toEqual([]);
    await expect(service.search('   ')).resolves.toEqual([]);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('defaults mustChangePassword to false when creating a user without the flag', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: '1', ...data }),
    );

    await service.create({ username: 'noa', password: 'secret123' });

    expect(prisma.user.create.mock.calls[0][0].data.mustChangePassword).toBe(
      false,
    );
  });

  it('sets mustChangePassword to true when explicitly requested during creation', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: '1', ...data }),
    );

    await service.create({
      username: 'noa',
      password: 'secret123',
      mustChangePassword: true,
    });

    expect(prisma.user.create.mock.calls[0][0].data.mustChangePassword).toBe(
      true,
    );
  });

  it('forces mustChangePassword to true on a password update by default', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: '1', username: 'noa' });
    prisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: '1', ...data }),
    );

    await service.update('1', { password: 'newsecret123' });

    expect(prisma.user.update.mock.calls[0][0].data.mustChangePassword).toBe(
      true,
    );
  });

  it('does not force mustChangePassword when a password update explicitly opts out', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: '1', username: 'noa' });
    prisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: '1', ...data }),
    );

    await service.update('1', {
      password: 'newsecret123',
      mustChangePassword: false,
    });

    expect(prisma.user.update.mock.calls[0][0].data.mustChangePassword).toBe(
      false,
    );
  });

  it('returns a user by id', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: '1', username: 'noa' });

    const result = await service.findById('1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: '1' } });
    expect(result).toEqual({ id: '1', username: 'noa' });
  });

  it('returns the full public profile by id', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: '1',
      username: 'noa',
      birthday: null,
      favoriteDrink: null,
      allergies: null,
      avatarUrl: null,
    });

    const result = await service.findPublicById('1');

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: '1' },
      select: {
        id: true,
        username: true,
        role: true,
        vip: true,
        createdAt: true,
        mustChangePassword: true,
        birthday: true,
        favoriteDrink: true,
        allergies: true,
        avatarUrl: true,
      },
    });
    expect(result?.username).toBe('noa');
  });

  it('sets profile fields to null when cleared, and parses birthday to a Date when provided', async () => {
    prisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: '1', ...data }),
    );

    await service.updateProfile('1', {
      birthday: '1995-08-15',
      favoriteDrink: 'Mojito',
      allergies: '',
      avatarUrl: '',
    });

    const updateArgs = prisma.user.update.mock.calls[0][0];
    expect(updateArgs.data.birthday).toEqual(new Date('1995-08-15'));
    expect(updateArgs.data.favoriteDrink).toBe('Mojito');
    expect(updateArgs.data.allergies).toBeNull();
    expect(updateArgs.data.avatarUrl).toBeNull();
  });

  it('clears birthday to null when not provided', async () => {
    prisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: '1', ...data }),
    );

    await service.updateProfile('1', {});

    const updateArgs = prisma.user.update.mock.calls[0][0];
    expect(updateArgs.data.birthday).toBeNull();
  });
});
