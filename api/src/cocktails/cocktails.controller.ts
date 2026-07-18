import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { CocktailsService } from './cocktails.service';

@Controller('cocktails')
export class CocktailsController {
  constructor(
    private readonly cocktailsService: CocktailsService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  async evaluate(@Req() req: Request, @Query('barId') barId: string) {
    const user = req.user as JwtPayload;
    const { canSeeVip } = await this.barAccessService.assertMember(barId, user);
    return this.cocktailsService.evaluate(barId, canSeeVip);
  }
}
