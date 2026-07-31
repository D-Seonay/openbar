import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBottleDto } from './dto/create-bottle.dto';
import { UpdateBottleDto } from './dto/update-bottle.dto';
import { deleteUploadedImage } from './uploads';

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
    const bottle = await this.findOne(id);
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

    // Drop the uploaded file now that the row is gone, otherwise the volume
    // accumulates orphans forever. Done *after* the delete so a rejected
    // delete (P2003 above) never leaves a surviving bottle without its image.
    await this.deleteImageIfUnused(bottle.imageUrl);

    return { success: true };
  }

  /**
   * Uploads get unique filenames, so normally nothing else points at this file.
   * But `imageUrl` is a free-form client-supplied string, so a bottle can be
   * saved pointing at another bottle's image — or at a user's avatar, which now
   * lives in the same directory. Check before unlinking.
   */
  private async deleteImageIfUnused(imageUrl: string | null) {
    if (!imageUrl) return;

    const [bottlesUsing, usersUsing] = await Promise.all([
      this.prisma.bottle.count({ where: { imageUrl } }),
      this.prisma.user.count({ where: { avatarUrl: imageUrl } }),
    ]);
    if (bottlesUsing > 0 || usersUsing > 0) return;

    await deleteUploadedImage(imageUrl);
  }
}
