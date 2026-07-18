import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBottleDto } from './dto/create-bottle.dto';
import { UpdateBottleDto } from './dto/update-bottle.dto';

@Injectable()
export class BottlesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(barId: string, includeVip: boolean) {
    return this.prisma.bottle.findMany({
      where: { barId, ...(includeVip ? {} : { vip: false }) },
      include: { volumes: true },
      orderBy: { name: 'asc' },
    });
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
    try {
      await this.prisma.bottle.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException(
          "Impossible de supprimer cette bouteille : elle est référencée dans des ajustements de stock",
        );
      }
      throw error;
    }
    return { success: true };
  }
}
