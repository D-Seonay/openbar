import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { canSeeVip } from '../auth/vip.util';
import { CocktailsService } from './cocktails.service';

@Controller('cocktails')
export class CocktailsController {
  constructor(private readonly cocktailsService: CocktailsService) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  evaluate(@Req() req: Request) {
    return this.cocktailsService.evaluate(canSeeVip(req.user as JwtPayload | undefined));
  }
}
