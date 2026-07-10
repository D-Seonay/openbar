import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { ApplyStockAdjustmentsDto } from './dto/apply-stock-adjustments.dto';

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
@Controller('events/:slug/stock-adjustments')
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
  ) {}

  @Get()
  findAll(@Param('slug') slug: string) {
    return this.stockAdjustmentsService.findForEvent(slug);
  }

  @Post()
  apply(@Param('slug') slug: string, @Body() dto: ApplyStockAdjustmentsDto) {
    return this.stockAdjustmentsService.apply(slug, dto);
  }
}
