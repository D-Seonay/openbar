import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBottleDto } from './dto/create-bottle.dto';
import { UpdateBottleDto } from './dto/update-bottle.dto';

@Injectable()
export class BottlesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.bottle.findMany({ include: { volumes: true }, orderBy: { name: 'asc' } });
  }

  async findOne(id: string) {
    const bottle = await this.prisma.bottle.findUnique({ where: { id }, include: { volumes: true } });
    if (!bottle) throw new NotFoundException('Bouteille introuvable');
    return bottle;
  }

  create(dto: CreateBottleDto) {
    const { volumes, ...rest } = dto;
    return this.prisma.bottle.create({
      data: { ...rest, volumes: volumes ? { create: volumes } : undefined },
      include: { volumes: true },
    });
  }

  async update(id: string, dto: UpdateBottleDto) {
    await this.findOne(id);
    const { volumes, ...rest } = dto;
    return this.prisma.bottle.update({
      where: { id },
      data: {
        ...rest,
        ...(volumes ? { volumes: { deleteMany: {}, create: volumes } } : {}),
      },
      include: { volumes: true },
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.bottle.delete({ where: { id } });
    return { success: true };
  }
}
