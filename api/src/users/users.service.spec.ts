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
      Promise.resolve({ id: '1', username: data.username, role: data.role, vip: data.vip, createdAt: new Date() }),
    );

    await service.create({ username: 'noa', password: 'secret123' });

    const createArgs = prisma.user.create.mock.calls[0][0];
    expect(createArgs.data.passwordHash).not.toBe('secret123');
    expect(createArgs.data.passwordHash.length).toBeGreaterThan(20);
  });

  it('rejects creating a user with a username that already exists', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(service.create({ username: 'noa', password: 'secret123' })).rejects.toThrow(
      ConflictException,
    );
  });

  it('throws a ConflictException when deleting a user with associated contributions', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });
    prisma.user.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
      }),
    );

    await expect(service.remove('existing')).rejects.toThrow(ConflictException);
  });

  it('hashes a new password when updating a user with one', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: '1', username: 'noa' });
    prisma.user.update.mockImplementation(({ data }) =>
      Promise.resolve({ id: '1', username: 'noa', role: 'USER', vip: false, createdAt: new Date(), ...data }),
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
});
