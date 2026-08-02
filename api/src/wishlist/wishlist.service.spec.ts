import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

describe('WishlistService', () => {
  let service: WishlistService;
  let prisma: { wishlistItem: Record<string, jest.Mock> };
  let eventsService: { findBySlug: jest.Mock };

  beforeEach(async () => {
    prisma = {
      wishlistItem: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
    };
    eventsService = { findBySlug: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        WishlistService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventsService, useValue: eventsService },
      ],
    }).compile();
    service = moduleRef.get(WishlistService);
  });

  it('resolves the slug to an eventId before listing items', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });

    await service.findForEvent('apero-du-samedi-a1b2c3d4');

    expect(eventsService.findBySlug).toHaveBeenCalledWith('apero-du-samedi-a1b2c3d4');
    expect(prisma.wishlistItem.findMany).toHaveBeenCalledWith({
      where: { eventId: 'event-1' },
      orderBy: { createdAt: 'asc' },
    });
  });

  it('resolves the slug to an eventId before creating an item', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.create.mockResolvedValue({ id: 'item-1', eventId: 'event-1', label: 'Glaçons' });

    const result = await service.create('apero-du-samedi-a1b2c3d4', 'Glaçons');

    expect(prisma.wishlistItem.create).toHaveBeenCalledWith({
      data: { eventId: 'event-1', label: 'Glaçons' },
    });
    expect(result).toEqual({ id: 'item-1', eventId: 'event-1', label: 'Glaçons' });
  });

  it('deletes an item that belongs to the resolved event', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({ id: 'item-1', eventId: 'event-1', label: 'Glaçons' });

    const result = await service.remove('apero-du-samedi-a1b2c3d4', 'item-1');

    expect(prisma.wishlistItem.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } });
    expect(result).toEqual({ success: true });
  });

  it('rejects deleting an item that belongs to a different event', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({ id: 'item-1', eventId: 'event-2', label: 'Glaçons' });

    await expect(service.remove('apero-du-samedi-a1b2c3d4', 'item-1')).rejects.toThrow(NotFoundException);
    expect(prisma.wishlistItem.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting an item that does not exist', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue(null);

    await expect(service.remove('apero-du-samedi-a1b2c3d4', 'missing')).rejects.toThrow(NotFoundException);
  });
});
