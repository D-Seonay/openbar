import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildBoardEmbed, type BoardItem } from './board';

const API_BASE = process.env.DISCORD_API_BASE ?? 'https://discord.com/api/v10';
const BOT_TOKEN = process.env.DISCORD_BOT_TOKEN ?? '';
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

/** The board sits behind a guest's click, so it must not hang the request. */
const TIMEOUT_MS = 6000;

@Injectable()
export class DiscordBoardService {
  private readonly logger = new Logger(DiscordBoardService.name);

  constructor(private readonly prisma: PrismaService) {}

  private configured(): boolean {
    return Boolean(BOT_TOKEN);
  }

  private async call(
    path: string,
    method: 'POST' | 'PATCH',
    body: unknown,
  ): Promise<{ id?: string } | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bot ${BOT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        this.logger.warn(`Discord ${method} ${path} → ${res.status}`);
        return null;
      }
      return (await res.json()) as { id?: string };
    } catch (error) {
      this.logger.warn(`Discord ${method} ${path} : ${String(error)}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Publish (or refresh) the "à ramener" board for a soirée.
   *
   * Never throws and never awaited by the caller's critical path: a guest
   * claiming an item must succeed even if Discord is down, rate-limiting us, or
   * the channel was deleted. A missed refresh is fixed by the next change.
   */
  async publish(slug: string): Promise<void> {
    if (!this.configured()) return;

    try {
      const event = await this.prisma.event.findUnique({
        where: { slug },
        include: {
          bar: { select: { discordChannelId: true } },
          wishlistItems: {
            orderBy: { createdAt: 'asc' },
            include: {
              assignments: {
                orderBy: { createdAt: 'asc' },
                include: {
                  user: { select: { username: true, discordUserId: true } },
                },
              },
            },
          },
        },
      });

      const channelId = event?.bar.discordChannelId;
      if (!event || !channelId) return;

      const items: BoardItem[] = event.wishlistItems.map((item) => ({
        label: item.label,
        neededCount: item.neededCount,
        // A linked guest is shown as a real Discord mention, so they get the
        // ping; everyone else falls back to their OpenBar name.
        assignees: item.assignments.map((a) =>
          a.user.discordUserId ? `<@${a.user.discordUserId}>` : a.user.username,
        ),
      }));

      const embed = buildBoardEmbed({
        eventName: event.name,
        eventDate: event.date,
        eventUrl: `${WEB_ORIGIN}/soirees/${event.slug}`,
        items,
      });

      if (event.discordMessageId) {
        const edited = await this.call(
          `/channels/${channelId}/messages/${event.discordMessageId}`,
          'PATCH',
          { embeds: [embed] },
        );
        // The message was deleted in Discord: fall through and post a new one
        // rather than going silent forever.
        if (edited) return;
      }

      const posted = await this.call(
        `/channels/${channelId}/messages`,
        'POST',
        {
          embeds: [embed],
        },
      );
      if (posted?.id) {
        await this.prisma.event.update({
          where: { id: event.id },
          data: { discordMessageId: posted.id },
        });
      }
    } catch (error) {
      this.logger.warn(
        `Publication du tableau échouée pour ${slug} : ${String(error)}`,
      );
    }
  }
}
