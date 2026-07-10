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
});
