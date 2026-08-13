import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { buildCalendar, type IcsEvent } from './ics';

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private toIcsEvent(
    event: { slug: string; name: string; date: string; bar: { name: string } },
    webOrigin: string,
  ): IcsEvent {
    return {
      // Stable per soirée, so re-importing updates the entry instead of
      // creating a duplicate.
      uid: `soiree-${event.slug}@openbar`,
      date: event.date,
      summary: event.name,
      description: `Soirée organisée au bar « ${event.bar.name} ».`,
      url: `${webOrigin}/soirees/${event.slug}`,
    };
  }

  /** One soirée, for a one-off "add to my calendar". */
  async oneEvent(slug: string, webOrigin: string): Promise<string> {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: { bar: { select: { name: true } } },
    });
    if (!event) throw new NotFoundException('Soirée introuvable');
    return buildCalendar(event.name, [this.toIcsEvent(event, webOrigin)]);
  }

  /**
   * Hand out the feed URL's secret, creating it on first use.
   *
   * Calendar clients poll without cookies, so this token *is* the credential.
   * Regenerating it is the way to revoke every subscription at once.
   */
  async ensureToken(userId: string, regenerate = false): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { calendarToken: true },
    });
    if (!user) throw new NotFoundException('Utilisateur introuvable');
    if (user.calendarToken && !regenerate) return user.calendarToken;

    const token = randomBytes(24).toString('base64url');
    await this.prisma.user.update({
      where: { id: userId },
      data: { calendarToken: token },
    });
    return token;
  }

  /**
   * Every soirée of every bar the holder belongs to.
   *
   * Resolved from the token alone — there is no session on a poll from Google
   * or Apple — so the token is looked up first and the feed is built strictly
   * from that user's memberships.
   */
  async feedForToken(token: string, webOrigin: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { calendarToken: token },
      select: { id: true, username: true, isArchived: true },
    });
    // A vague 404 rather than a 403: an unauthenticated caller should not learn
    // whether a token exists.
    if (!user || user.isArchived) throw new NotFoundException('Calendrier introuvable');

    const events = await this.prisma.event.findMany({
      where: { bar: { memberships: { some: { userId: user.id } } } },
      include: { bar: { select: { name: true } } },
      orderBy: { date: 'asc' },
    });

    return buildCalendar(
      `Soirées OpenBar — ${user.username}`,
      events.map((event) => this.toIcsEvent(event, webOrigin)),
    );
  }
}
