import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { EventsService } from '../events/events.service';
import { WishlistService } from './wishlist.service';
import { CreateWishlistItemDto } from './dto/create-wishlist-item.dto';

@Controller('events/:slug/wishlist')
export class WishlistController {
  constructor(
    private readonly wishlistService: WishlistService,
    private readonly eventsService: EventsService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(@Param('slug') slug: string) {
    return this.wishlistService.findForEvent(slug);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Param('slug') slug: string,
    @Body() dto: CreateWishlistItemDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(
      event.barId,
      user,
    );
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        "Seul l'hôte de la soirée peut gérer la liste à ramener",
      );
    }
    return this.wishlistService.create(slug, dto.label);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async remove(
    @Param('slug') slug: string,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(
      event.barId,
      user,
    );
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        "Seul l'hôte de la soirée peut gérer la liste à ramener",
      );
    }
    return this.wishlistService.remove(slug, id);
  }
}
