import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { discordFetch, isBotConfigured } from './discord-rest';

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

/** Discord caps a poll at 10 answers and 32 days. */
export const MAX_POLL_ANSWERS = 10;
export const MAX_POLL_HOURS = 768;

export interface DmOutcome {
  sent: number;
  failed: number;
  /** Members of the bar who never linked Discord, so could not be reached. */
  unlinked: number;
  /** Not attempted because the overall budget ran out. Never silently dropped. */
  pending: number;
}

/**
 * A few at a time. Sequential meant a bar of thirty could hold the host's
 * request open for minutes; unbounded parallelism would just trip Discord's
 * rate limiter, which the REST client then has to sit out.
 */
const CONCURRENCY = 4;

/**
 * Whole-broadcast budget. Past this the remainder is reported as pending
 * rather than left to time out somewhere in a proxy. Overridable so the tests
 * can exercise the cutoff without waiting twenty seconds for it.
 */
const BUDGET_MS = Number(process.env.DISCORD_BROADCAST_BUDGET_MS) || 20000;

@Injectable()
export class DiscordNotifyService {
  private readonly logger = new Logger(DiscordNotifyService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * DM every member of the bar who linked their Discord.
   *
   * Reports counts rather than throwing on a failed recipient: a bot can only
   * DM someone who shares a guild with it and has DMs open, so partial failure
   * is the normal case, not an error. The host sees how many got through.
   */
  async announceEvent(slug: string, senderId: string): Promise<DmOutcome> {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: { bar: { select: { id: true, name: true } } },
    });
    if (!event) throw new NotFoundException('Soirée introuvable');

    const members = await this.prisma.barMembership.findMany({
      where: { barId: event.bar.id },
      include: { user: { select: { id: true, discordUserId: true } } },
    });

    const recipients = members
      .map((m) => m.user)
      // Not to the person who pressed the button: they know.
      .filter((u) => u.discordUserId && u.id !== senderId);
    const unlinked = members.length - recipients.length;

    if (!isBotConfigured()) {
      return { sent: 0, failed: recipients.length, unlinked, pending: 0 };
    }

    const date = new Date(event.date).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
    const content =
      `🍹 **${event.name}** — ${date}\n` +
      `Soirée au bar « ${event.bar.name} ».\n` +
      `Dis ce que tu ramènes : ${WEB_ORIGIN}/soirees/${event.slug}`;

    let sent = 0;
    let failed = 0;
    const startedAt = Date.now();

    const queue = [...recipients];
    const dmOne = async (discordUserId: string): Promise<boolean> => {
      // A DM needs its own channel, opened once per recipient.
      const channel = await discordFetch<{ id?: string }>(
        '/users/@me/channels',
        {
          method: 'POST',
          body: { recipient_id: discordUserId },
        },
      );
      if (!channel?.id) return false;
      const message = await discordFetch(`/channels/${channel.id}/messages`, {
        method: 'POST',
        body: { content },
      });
      return Boolean(message);
    };

    const worker = async () => {
      while (queue.length > 0) {
        // Checked per item so a slow run stops cleanly instead of overrunning.
        if (Date.now() - startedAt > BUDGET_MS) return;
        const next = queue.shift();
        if (!next?.discordUserId) continue;
        if (await dmOne(next.discordUserId)) sent += 1;
        else failed += 1;
      }
    };

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, recipients.length) }, worker),
    );
    const pending = queue.length;

    this.logger.log(
      `Annonce ${slug} : ${sent} envoyés, ${failed} échoués, ${unlinked} non liés, ${pending} en attente`,
    );
    return { sent, failed, unlinked, pending };
  }

  /**
   * Post a native Discord poll in the bar's channel.
   *
   * Native rather than reactions on a message: Discord tallies the votes, keeps
   * them anonymous until the end, and closes on its own.
   */
  async createPoll(
    barId: string,
    question: string,
    answers: string[],
    hours: number,
  ): Promise<{ posted: boolean; reason?: string }> {
    const bar = await this.prisma.bar.findUnique({
      where: { id: barId },
      select: { discordChannelId: true },
    });
    if (!bar?.discordChannelId) {
      return { posted: false, reason: 'Aucun salon Discord lié à ce bar.' };
    }
    if (!isBotConfigured()) {
      return { posted: false, reason: "Le bot Discord n'est pas configuré." };
    }

    const trimmed = answers
      .map((a) => a.trim())
      .filter(Boolean)
      .slice(0, MAX_POLL_ANSWERS);
    if (trimmed.length < 2) {
      return { posted: false, reason: 'Il faut au moins deux réponses.' };
    }

    const posted = await discordFetch(
      `/channels/${bar.discordChannelId}/messages`,
      {
        method: 'POST',
        body: {
          poll: {
            question: { text: question.slice(0, 300) },
            answers: trimmed.map((text) => ({
              poll_media: { text: text.slice(0, 55) },
            })),
            duration: Math.min(Math.max(Math.trunc(hours), 1), MAX_POLL_HOURS),
            allow_multiselect: false,
          },
        },
      },
    );

    return posted
      ? { posted: true }
      : {
          posted: false,
          reason: 'Discord a refusé la publication du sondage.',
        };
  }
}
