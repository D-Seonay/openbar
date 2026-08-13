import { Controller, Get, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { JwtPayload } from '../auth/auth.service';
import { EventsService } from '../events/events.service';
import { BarAccessService } from '../bars/bar-access.service';
import { CalendarService } from './calendar.service';

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

@Controller()
export class CalendarController {
  constructor(
    private readonly calendarService: CalendarService,
    private readonly eventsService: EventsService,
    private readonly barAccessService: BarAccessService,
  ) {}

  /** One soirée as a downloadable .ics. */
  @UseGuards(JwtAuthGuard)
  @Get('events/:slug/calendar.ics')
  async oneEvent(
    @Req() req: Request,
    @Res() res: Response,
    @Param('slug') slug: string,
  ) {
    const user = req.user as JwtPayload;
    const event = await this.eventsService.findBySlug(slug);
    await this.barAccessService.assertMember(event.barId, user);

    const ics = await this.calendarService.oneEvent(slug, WEB_ORIGIN);
    send(res, ics, `${slug}.ics`);
  }

  /** Create (or rotate) the personal feed secret. */
  @UseGuards(JwtAuthGuard)
  @Post('calendar/token')
  async issueToken(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return { token: await this.calendarService.ensureToken(user.sub) };
  }

  @UseGuards(JwtAuthGuard)
  @Post('calendar/token/rotate')
  async rotateToken(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return { token: await this.calendarService.ensureToken(user.sub, true) };
  }

  /**
   * The subscription feed. Deliberately unguarded: Google and Apple poll
   * without cookies, so the secret in the path is the only credential.
   */
  @Get('calendar/:token.ics')
  async feed(@Res() res: Response, @Param('token') token: string) {
    const ics = await this.calendarService.feedForToken(token, WEB_ORIGIN);
    send(res, ics, 'soirees.ics');
  }
}

function send(res: Response, ics: string, filename: string) {
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // A feed that is cached hard never shows a new soirée.
  res.setHeader('Cache-Control', 'no-store');
  res.send(ics);
}
