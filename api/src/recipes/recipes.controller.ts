import { Body, Controller, Delete, ForbiddenException, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { canSeeVip } from '../auth/vip.util';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from './dto/create-recipe.dto';
import { UpdateRecipeDto } from './dto/update-recipe.dto';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @UseGuards(JwtAuthGuard)
  @Post()
  create(@Req() req: Request, @Body() dto: CreateRecipeDto) {
    const user = req.user as JwtPayload;
    if (!canSeeVip(user)) {
      throw new ForbiddenException('Réservé aux comptes VIP ou Admin');
    }
    return this.recipesService.create(dto, user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateRecipeDto) {
    return this.recipesService.update(id, dto, req.user as JwtPayload);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(@Req() req: Request, @Param('id') id: string) {
    return this.recipesService.remove(id, req.user as JwtPayload);
  }
}
