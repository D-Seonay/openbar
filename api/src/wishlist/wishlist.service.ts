import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

// Every assignment read exposes the same public shape. Kept in one place so the
// call sites below can't drift apart — the UI renders an avatar per assignee
// and silently falls back to initials if `avatarUrl` goes missing.
const ASSIGNEE_SELECT = {
  id: true,
  username: true,
  avatarUrl: true,
} as const;

@Injectable()
export class WishlistService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async findForEvent(slug: string) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.wishlistItem.findMany({
      where: { eventId: event.id },
      orderBy: { createdAt: 'asc' },
      include: {
        assignments: {
          orderBy: { createdAt: 'asc' },
          include: { user: { select: ASSIGNEE_SELECT } },
        },
      },
    });
  }

  async create(slug: string, label: string, neededCount = 1) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.wishlistItem.create({
      data: { eventId: event.id, label, neededCount },
      include: {
        assignments: {
          include: { user: { select: ASSIGNEE_SELECT } },
        },
      },
    });
  }

  async remove(slug: string, id: string) {
    const event = await this.eventsService.findBySlug(slug);
    const item = await this.prisma.wishlistItem.findUnique({ where: { id } });
    if (!item || item.eventId !== event.id) {
      throw new NotFoundException('Item introuvable');
    }
    await this.prisma.wishlistItem.delete({ where: { id } });
    return { success: true };
  }

  async assign(slug: string, itemId: string, userId: string) {
    const event = await this.eventsService.findBySlug(slug);
    const item = await this.prisma.wishlistItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.eventId !== event.id) {
      throw new NotFoundException('Item introuvable');
    }
    const existing = await this.prisma.wishlistItemAssignment.findUnique({
      where: { wishlistItemId_userId: { wishlistItemId: itemId, userId } },
      include: { user: { select: ASSIGNEE_SELECT } },
    });
    if (existing) return existing;

    try {
      return await this.prisma.$transaction(async (tx) => {
        // Lock the item row for the duration of the transaction. Counting and
        // then inserting without this is a race: two guests both read "2 of 3
        // taken" and both insert, and the item ends up over-subscribed. The
        // lock is on the parent, so it only serialises claims on this one item.
        await tx.$queryRaw`SELECT id FROM "WishlistItem" WHERE id = ${itemId} FOR UPDATE`;

        const taken = await tx.wishlistItemAssignment.count({
          where: { wishlistItemId: itemId },
        });
        if (taken >= item.neededCount) {
          throw new ConflictException('Cet item est déjà complet');
        }

        return tx.wishlistItemAssignment.create({
          data: { wishlistItemId: itemId, userId },
          include: { user: { select: ASSIGNEE_SELECT } },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        // A concurrent request created the same assignment first; return that row.
        return this.prisma.wishlistItemAssignment.findUnique({
          where: { wishlistItemId_userId: { wishlistItemId: itemId, userId } },
          include: { user: { select: ASSIGNEE_SELECT } },
        });
      }
      throw error;
    }
  }

  async unassign(slug: string, itemId: string, userId: string) {
    const event = await this.eventsService.findBySlug(slug);
    const item = await this.prisma.wishlistItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.eventId !== event.id) {
      throw new NotFoundException('Item introuvable');
    }
    const { count } = await this.prisma.wishlistItemAssignment.deleteMany({
      where: { wishlistItemId: itemId, userId },
    });
    if (count === 0) {
      throw new NotFoundException('Assignation introuvable');
    }
    return { success: true };
  }
}
