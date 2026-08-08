import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { BarAccessService } from '../bars/bar-access.service';
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';

@UseGuards(JwtAuthGuard)
@Controller('events')
export class EventsController {
  constructor(
    private readonly eventsService: EventsService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @Get()
  async findAll(@Req() req: Request, @Query('barId') barId: string) {
    const user = req.user as JwtPayload;
    await this.barAccessService.assertMember(barId, user);
    return this.eventsService.findAll(barId);
  }

  @Get(':slug')
  async findOne(@Req() req: Request, @Param('slug') slug: string) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    await this.barAccessService.assertMember(event.barId, user);
    return event;
  }

  @Post()
  async create(@Req() req: Request, @Body() dto: CreateEventDto) {
    const user = req.user as JwtPayload;
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(
      dto.barId,
      user,
    );
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        'Seul le propriétaire du bar peut créer une soirée',
      );
    }
    return this.eventsService.create(dto);
  }

  @Delete(':slug')
  async remove(@Req() req: Request, @Param('slug') slug: string) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(
      event.barId,
      user,
    );
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        'Seul le propriétaire du bar peut supprimer une soirée',
      );
    }
    return this.eventsService.remove(slug);
  }
}
