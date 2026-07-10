import { Injectable, NotFoundException } from '@nestjs/common';
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

  findAll() {
    return this.prisma.event.findMany({ orderBy: { date: 'asc' } });
  }

  async findBySlug(slug: string) {
    const event = await this.prisma.event.findUnique({ where: { slug } });
    if (!event) throw new NotFoundException('Soirée introuvable');
    return event;
  }

  async create(dto: CreateEventDto) {
    const base = slugify(dto.name);
    let slug = base;
    let n = 1;
    while (await this.prisma.event.findUnique({ where: { slug } })) {
      n += 1;
      slug = `${base}-${n}`;
    }
    return this.prisma.event.create({ data: { name: dto.name, date: dto.date, slug } });
  }

  async remove(slug: string) {
    await this.findBySlug(slug);
    await this.prisma.event.delete({ where: { slug } });
    return { success: true };
  }
}
