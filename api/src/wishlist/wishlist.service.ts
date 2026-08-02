import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';

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
    });
  }

  async create(slug: string, label: string) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.wishlistItem.create({
      data: { eventId: event.id, label },
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
}
