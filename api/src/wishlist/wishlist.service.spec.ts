import { Test } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WishlistService } from './wishlist.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

describe('WishlistService', () => {
  let service: WishlistService;
  let prisma: {
    wishlistItem: Record<string, jest.Mock>;
    wishlistItemAssignment: Record<string, jest.Mock>;
  };
  let eventsService: { findBySlug: jest.Mock };

  beforeEach(async () => {
    prisma = {
      wishlistItem: {
        findMany: jest.fn(),
        create: jest.fn(),
        findUnique: jest.fn(),
        delete: jest.fn(),
      },
      wishlistItemAssignment: {
        findUnique: jest.fn(),
        create: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
    };
    // `assign` now runs inside a transaction that locks the item row, so the
    // double has to provide both the transaction wrapper and the raw lock.
    (prisma as Record<string, unknown>).$queryRaw = jest.fn();
    (prisma as Record<string, unknown>).$transaction = jest.fn(
      (fn: (tx: unknown) => unknown) => fn(prisma),
    );
    prisma.wishlistItemAssignment.count = jest.fn().mockResolvedValue(0);
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

    expect(eventsService.findBySlug).toHaveBeenCalledWith(
      'apero-du-samedi-a1b2c3d4',
    );
    expect(prisma.wishlistItem.findMany).toHaveBeenCalledWith({
      where: { eventId: 'event-1' },
      orderBy: { createdAt: 'asc' },
      include: {
        assignments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } },
          },
        },
      },
    });
  });

  it('resolves the slug to an eventId before creating an item', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.create.mockResolvedValue({
      id: 'item-1',
      eventId: 'event-1',
      label: 'Glaçons',
      assignments: [],
    });

    const result = await service.create('apero-du-samedi-a1b2c3d4', 'Glaçons');

    expect(prisma.wishlistItem.create).toHaveBeenCalledWith({
      data: { eventId: 'event-1', label: 'Glaçons', neededCount: 1 },
      include: {
        assignments: {
          include: {
            user: { select: { id: true, username: true, avatarUrl: true } },
          },
        },
      },
    });
    expect(result).toEqual({
      id: 'item-1',
      eventId: 'event-1',
      label: 'Glaçons',
      assignments: [],
    });
  });

  it('deletes an item that belongs to the resolved event', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({
      id: 'item-1',
      eventId: 'event-1',
      label: 'Glaçons',
      neededCount: 1,
    });

    const result = await service.remove('apero-du-samedi-a1b2c3d4', 'item-1');

    expect(prisma.wishlistItem.delete).toHaveBeenCalledWith({
      where: { id: 'item-1' },
    });
    expect(result).toEqual({ success: true });
  });

  it('rejects deleting an item that belongs to a different event', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({
      id: 'item-1',
      eventId: 'event-2',
      label: 'Glaçons',
    });

    await expect(
      service.remove('apero-du-samedi-a1b2c3d4', 'item-1'),
    ).rejects.toThrow(NotFoundException);
    expect(prisma.wishlistItem.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting an item that does not exist', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue(null);

    await expect(
      service.remove('apero-du-samedi-a1b2c3d4', 'missing'),
    ).rejects.toThrow(NotFoundException);
  });

  it('creates an assignment when the user has not already claimed the item', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({
      id: 'item-1',
      eventId: 'event-1',
      label: 'Glaçons',
      neededCount: 1,
    });
    prisma.wishlistItemAssignment.findUnique.mockResolvedValue(null);
    const created = {
      id: 'assign-1',
      wishlistItemId: 'item-1',
      userId: 'user-1',
      user: {
        id: 'user-1',
        username: 'Alice',
        avatarUrl: '/uploads/alice.png',
      },
    };
    prisma.wishlistItemAssignment.create.mockResolvedValue(created);

    const result = await service.assign(
      'apero-du-samedi-a1b2c3d4',
      'item-1',
      'user-1',
    );

    expect(prisma.wishlistItemAssignment.create).toHaveBeenCalledWith({
      data: { wishlistItemId: 'item-1', userId: 'user-1' },
      include: {
        user: { select: { id: true, username: true, avatarUrl: true } },
      },
    });
    expect(result).toEqual(created);
  });

  it('is idempotent when the user has already claimed the item', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({
      id: 'item-1',
      eventId: 'event-1',
      label: 'Glaçons',
      neededCount: 1,
    });
    const existing = {
      id: 'assign-1',
      wishlistItemId: 'item-1',
      userId: 'user-1',
      user: {
        id: 'user-1',
        username: 'Alice',
        avatarUrl: '/uploads/alice.png',
      },
    };
    prisma.wishlistItemAssignment.findUnique.mockResolvedValue(existing);

    const result = await service.assign(
      'apero-du-samedi-a1b2c3d4',
      'item-1',
      'user-1',
    );

    expect(prisma.wishlistItemAssignment.create).not.toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  it('rejects assigning to an item from a different event', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({
      id: 'item-1',
      eventId: 'event-2',
      label: 'Glaçons',
    });

    await expect(
      service.assign('apero-du-samedi-a1b2c3d4', 'item-1', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns the existing assignment when a concurrent request already created it', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({
      id: 'item-1',
      eventId: 'event-1',
      label: 'Glaçons',
      neededCount: 1,
    });
    const createdByConcurrentRequest = {
      id: 'assign-1',
      wishlistItemId: 'item-1',
      userId: 'user-1',
      user: {
        id: 'user-1',
        username: 'Alice',
        avatarUrl: '/uploads/alice.png',
      },
    };
    prisma.wishlistItemAssignment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(createdByConcurrentRequest);
    prisma.wishlistItemAssignment.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '5.0.0',
      }),
    );

    const result = await service.assign(
      'apero-du-samedi-a1b2c3d4',
      'item-1',
      'user-1',
    );

    expect(result).toEqual(createdByConcurrentRequest);
  });

  it('removes the assignment when the caller owns it', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({
      id: 'item-1',
      eventId: 'event-1',
      label: 'Glaçons',
      neededCount: 1,
    });
    prisma.wishlistItemAssignment.deleteMany.mockResolvedValue({ count: 1 });

    const result = await service.unassign(
      'apero-du-samedi-a1b2c3d4',
      'item-1',
      'user-1',
    );

    expect(prisma.wishlistItemAssignment.deleteMany).toHaveBeenCalledWith({
      where: { wishlistItemId: 'item-1', userId: 'user-1' },
    });
    expect(result).toEqual({ success: true });
  });

  it('rejects unassigning when the caller has no assignment on the item', async () => {
    eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
    prisma.wishlistItem.findUnique.mockResolvedValue({
      id: 'item-1',
      eventId: 'event-1',
      label: 'Glaçons',
      neededCount: 1,
    });
    prisma.wishlistItemAssignment.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      service.unassign('apero-du-samedi-a1b2c3d4', 'item-1', 'user-1'),
    ).rejects.toThrow(NotFoundException);
  });

  describe('neededCount', () => {
    it('stores how many guests the host asked for', async () => {
      eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
      prisma.wishlistItem.create.mockResolvedValue({ id: 'item-1' });

      await service.create('slug', 'Sacs de glaçons', 3);

      expect(prisma.wishlistItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            eventId: 'event-1',
            label: 'Sacs de glaçons',
            neededCount: 3,
          },
        }),
      );
    });

    it('defaults to one guest, which is what every item did before', async () => {
      eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
      prisma.wishlistItem.create.mockResolvedValue({ id: 'item-1' });

      await service.create('slug', 'Glaçons');

      expect(prisma.wishlistItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { eventId: 'event-1', label: 'Glaçons', neededCount: 1 },
        }),
      );
    });

    it('lets a second guest join an item that wants three', async () => {
      eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
      prisma.wishlistItem.findUnique.mockResolvedValue({
        id: 'item-1',
        eventId: 'event-1',
        neededCount: 3,
      });
      prisma.wishlistItemAssignment.findUnique.mockResolvedValue(null);
      prisma.wishlistItemAssignment.count.mockResolvedValue(1);
      prisma.wishlistItemAssignment.create.mockResolvedValue({
        id: 'assign-2',
      });

      await service.assign('slug', 'item-1', 'user-2');

      expect(prisma.wishlistItemAssignment.create).toHaveBeenCalled();
    });

    it('refuses a claim once every slot is taken', async () => {
      eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
      prisma.wishlistItem.findUnique.mockResolvedValue({
        id: 'item-1',
        eventId: 'event-1',
        neededCount: 2,
      });
      prisma.wishlistItemAssignment.findUnique.mockResolvedValue(null);
      prisma.wishlistItemAssignment.count.mockResolvedValue(2);

      await expect(service.assign('slug', 'item-1', 'user-3')).rejects.toThrow(
        ConflictException,
      );
      expect(prisma.wishlistItemAssignment.create).not.toHaveBeenCalled();
    });

    it('locks the item row before counting, so two guests cannot take one slot', async () => {
      eventsService.findBySlug.mockResolvedValue({ id: 'event-1' });
      prisma.wishlistItem.findUnique.mockResolvedValue({
        id: 'item-1',
        eventId: 'event-1',
        neededCount: 1,
      });
      prisma.wishlistItemAssignment.findUnique.mockResolvedValue(null);
      prisma.wishlistItemAssignment.count.mockResolvedValue(0);
      prisma.wishlistItemAssignment.create.mockResolvedValue({
        id: 'assign-1',
      });

      await service.assign('slug', 'item-1', 'user-1');

      const raw = (prisma as unknown as { $queryRaw: jest.Mock }).$queryRaw;
      expect(raw).toHaveBeenCalled();
      const lockCalls = raw.mock.calls as unknown as unknown[][];
      expect(String(lockCalls[0][0])).toContain('FOR UPDATE');
    });
  });
});
