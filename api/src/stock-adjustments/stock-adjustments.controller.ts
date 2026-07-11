import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { ApplyStockAdjustmentsDto } from './dto/apply-stock-adjustments.dto';

@Controller('events/:slug/stock-adjustments')
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(@Param('slug') slug: string) {
    return this.stockAdjustmentsService.findForEvent(slug);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @Post()
  apply(@Param('slug') slug: string, @Body() dto: ApplyStockAdjustmentsDto) {
    return this.stockAdjustmentsService.apply(slug, dto);
  }
}
