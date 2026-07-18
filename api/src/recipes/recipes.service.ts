import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  findVisible(barId: string, includeVip: boolean) {
    return this.prisma.recipe.findMany({
      where: { barId, ...(includeVip ? {} : { vip: false }) },
      include: { createdBy: { select: { username: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const recipe = await this.prisma.recipe.findUnique({
      where: { id },
      include: { createdBy: { select: { username: true } } },
    });
    if (!recipe) throw new NotFoundException('Recette introuvable');
    return recipe;
  }

  create(dto: CreateRecipeDto, userId: string) {
    return this.prisma.recipe.create({
      data: { ...dto, createdById: userId },
      include: { createdBy: { select: { username: true } } },
    });
  }

  async update(id: string, dto: UpdateRecipeDto, user: JwtPayload) {
    const recipe = await this.findOne(id);
    this.assertOwnerOrAdmin(recipe, user);
    return this.prisma.recipe.update({
      where: { id },
      data: dto,
      include: { createdBy: { select: { username: true } } },
    });
  }

  async remove(id: string, user: JwtPayload) {
    const recipe = await this.findOne(id);
    this.assertOwnerOrAdmin(recipe, user);
    await this.prisma.recipe.delete({ where: { id } });
    return { success: true };
  }

  private assertOwnerOrAdmin(recipe: { createdById: string }, user: JwtPayload) {
    if (recipe.createdById !== user.sub && user.role !== 'ADMIN') {
      throw new ForbiddenException('Vous ne pouvez modifier que vos propres recettes');
    }
  }
}
