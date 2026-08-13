import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { DiscordService } from './discord.service';
import { LinkDiscordDto } from './dto/link-discord.dto';
import { CreatePollDto } from './dto/create-poll.dto';
import { DiscordNotifyService } from './notify.service';
import { EventsService } from '../events/events.service';
import { BarAccessService } from '../bars/bar-access.service';

@UseGuards(JwtAuthGuard)
@Controller('auth/discord')
export class DiscordController {
  constructor(
    private readonly discordService: DiscordService,
    private readonly notifyService: DiscordNotifyService,
    private readonly eventsService: EventsService,
    private readonly barAccessService: BarAccessService,
  ) {}

  @Post('link')
  async link(@Req() req: Request, @Body() dto: LinkDiscordDto) {
    const user = req.user as JwtPayload;
    return this.discordService.link(user.sub, dto.code);
  }

  @Delete('link')
  async unlink(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.discordService.unlink(user.sub);
  }

  /**
   * DM the soirée to every member who linked Discord. Owner-only: it messages
   * people directly, which is not something any guest should trigger.
   */
  @Post('announce/:slug')
  async announce(@Req() req: Request, @Param('slug') slug: string) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(
      event.barId,
      user,
    );
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        "Seul l'hôte peut annoncer la soirée en message privé",
      );
    }
    return this.notifyService.announceEvent(slug, user.sub);
  }

  /** Post a poll in the bar's channel. Owner-only, same reasoning. */
  @Post('poll/:barId')
  async poll(
    @Req() req: Request,
    @Param('barId') barId: string,
    @Body() dto: CreatePollDto,
  ) {
    const user = req.user as JwtPayload;
    const { isOwnerOrAdmin } = await this.barAccessService.assertMember(
      barId,
      user,
    );
    if (!isOwnerOrAdmin) {
      throw new ForbiddenException(
        'Seul le propriétaire du bar peut lancer un sondage',
      );
    }
    return this.notifyService.createPoll(
      barId,
      dto.question,
      dto.answers,
      dto.hours ?? 24,
    );
  }
}
