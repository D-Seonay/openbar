import { Body, Controller, ForbiddenException, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { EventsService } from '../events/events.service';
import { StockAdjustmentsService } from './stock-adjustments.service';
import { ApplyStockAdjustmentsDto } from './dto/apply-stock-adjustments.dto';

@UseGuards(JwtAuthGuard)
@Controller('events/:slug/stock-adjustments')
export class StockAdjustmentsController {
  constructor(
    private readonly stockAdjustmentsService: StockAdjustmentsService,
    private readonly eventsService: EventsService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @Get()
  async findAll(@Req() req: Request, @Param('slug') slug: string) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    await this.barAccessService.assertMember(event.barId, user);
    return this.stockAdjustmentsService.findForEvent(slug);
  }

  @Post()
  async apply(@Req() req: Request, @Param('slug') slug: string, @Body() dto: ApplyStockAdjustmentsDto) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(event.barId, user);
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException('Seul le propriétaire du bar peut valider un bilan de stock');
    }
    return this.stockAdjustmentsService.apply(slug, dto);
  }
}
