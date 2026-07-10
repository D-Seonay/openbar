import { Test } from '@nestjs/testing';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

describe('StockAdjustmentsService', () => {
  let service: StockAdjustmentsService;
  let prisma: {
    bottle: { findUnique: jest.Mock; update: jest.Mock };
    bottleVolume: { update: jest.Mock; deleteMany: jest.Mock };
    stockAdjustment: { create: jest.Mock };
  };
  let eventsService: { findBySlug: jest.Mock };

  beforeEach(async () => {
    prisma = {
      bottle: { findUnique: jest.fn(), update: jest.fn() },
      bottleVolume: { update: jest.fn(), deleteMany: jest.fn() },
      stockAdjustment: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'adj-1', ...data }),
          ),
      },
    };
    eventsService = {
      findBySlug: jest.fn().mockResolvedValue({ id: 'event-1', slug: 'apero' }),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        StockAdjustmentsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();

    service = moduleRef.get(StockAdjustmentsService);
  });

  it('removes consumed units from the last volume entries first', async () => {
    prisma.bottle.findUnique.mockResolvedValue({
      id: 'bottle-1',
      name: 'Rhum',
      quantity: 3,
      volumes: [
        { id: 'vol-1', quantity: 1 },
        { id: 'vol-2', quantity: 2 },
      ],
    });

    await service.apply('apero', {
      changes: [{ bottleId: 'bottle-1', quantityAfter: 1 }],
    });

    expect(prisma.bottleVolume.update).toHaveBeenCalledWith({
      where: { id: 'vol-2' },
      data: { quantity: 0 },
    });
    expect(prisma.bottleVolume.deleteMany).toHaveBeenCalledWith({
      where: { bottleId: 'bottle-1', quantity: { lte: 0 } },
    });
    expect(prisma.bottle.update).toHaveBeenCalledWith({
      where: { id: 'bottle-1' },
      data: { quantity: 1 },
    });
  });

  it('adds returned units to the first volume entry when quantity increases', async () => {
    prisma.bottle.findUnique.mockResolvedValue({
      id: 'bottle-1',
      name: 'Rhum',
      quantity: 1,
      volumes: [{ id: 'vol-1', quantity: 1 }],
    });

    await service.apply('apero', {
      changes: [{ bottleId: 'bottle-1', quantityAfter: 2 }],
    });

    expect(prisma.bottleVolume.update).toHaveBeenCalledWith({
      where: { id: 'vol-1' },
      data: { quantity: 2 },
    });
  });

  it('skips bottles where the quantity is unchanged', async () => {
    prisma.bottle.findUnique.mockResolvedValue({
      id: 'bottle-1',
      name: 'Rhum',
      quantity: 2,
      volumes: [],
    });

    const result = await service.apply('apero', {
      changes: [{ bottleId: 'bottle-1', quantityAfter: 2 }],
    });

    expect(result).toEqual([]);
    expect(prisma.bottle.update).not.toHaveBeenCalled();
  });
});
