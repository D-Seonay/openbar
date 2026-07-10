import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { BottlesService } from './bottles.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BottlesService', () => {
  let service: BottlesService;
  let prisma: { bottle: Record<string, jest.Mock> };

  beforeEach(async () => {
    prisma = {
      bottle: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: [BottlesService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(BottlesService);
  });

  it('throws a ConflictException when deleting a bottle referenced in stock adjustments', async () => {
    prisma.bottle.findUnique.mockResolvedValue({ id: 'bottle-1', name: 'Rhum' });
    prisma.bottle.delete.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', {
        code: 'P2003',
        clientVersion: '5.0.0',
      }),
    );

    await expect(service.remove('bottle-1')).rejects.toThrow(ConflictException);
  });
});
