import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CocktailsService } from './cocktails.service';

@UseGuards(JwtAuthGuard)
@Controller('cocktails')
export class CocktailsController {
  constructor(private readonly cocktailsService: CocktailsService) {}

  @Get()
  evaluate() {
    return this.cocktailsService.evaluate();
  }
}
