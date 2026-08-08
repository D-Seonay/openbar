import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto } from './dto/create-event.dto';

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'soiree'
  );
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(barId: string) {
    return this.prisma.event.findMany({
      where: { barId },
      orderBy: { date: 'asc' },
      include: {
        _count: {
          select: { stockAdjustments: true },
        },
      },
    });
  }

  async findBySlug(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        _count: {
          select: { stockAdjustments: true },
        },
      },
    });
    if (!event) throw new NotFoundException('Soirée introuvable');
    return event;
  }

  async create(dto: CreateEventDto) {
    const base = slugify(dto.name);
    let slug = `${base}-${randomBytes(4).toString('hex')}`;
    while (await this.prisma.event.findUnique({ where: { slug } })) {
      slug = `${base}-${randomBytes(4).toString('hex')}`;
    }
    return this.prisma.event.create({
      data: { barId: dto.barId, name: dto.name, date: dto.date, slug },
    });
  }

  async remove(slug: string) {
    await this.findBySlug(slug);
    await this.prisma.event.delete({ where: { slug } });
    return { success: true };
  }
}
