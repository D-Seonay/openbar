import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventsService } from '../events/events.service';
import { CreateContributionDto } from './dto/create-contribution.dto';

@Injectable()
export class ContributionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsService: EventsService,
  ) {}

  async findForEvent(slug: string) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.contribution.findMany({
      where: { eventId: event.id },
      include: { user: { select: { id: true, username: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  async create(slug: string, userId: string, dto: CreateContributionDto) {
    const event = await this.eventsService.findBySlug(slug);
    return this.prisma.contribution.create({
      data: {
        eventId: event.id,
        userId,
        item: dto.item,
        quantity: dto.quantity,
      },
      include: { user: { select: { id: true, username: true } } },
    });
  }

  async remove(id: string, userId: string) {
    const contribution = await this.prisma.contribution.findUnique({
      where: { id },
    });
    if (!contribution || contribution.userId !== userId) {
      throw new NotFoundException('Contribution introuvable');
    }
    await this.prisma.contribution.delete({ where: { id } });
    return { success: true };
  }
}
