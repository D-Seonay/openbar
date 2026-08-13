import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { buildBoardEmbed, type BoardItem } from './board';
import { discordFetch, isBotConfigured } from './discord-rest';

const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:3000';

@Injectable()
export class DiscordBoardService {
  private readonly logger = new Logger(DiscordBoardService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Publish (or refresh) the "à ramener" board for a soirée.
   *
   * Never throws and never awaited by the caller's critical path: a guest
   * claiming an item must succeed even if Discord is down, rate-limiting us, or
   * the channel was deleted. A missed refresh is fixed by the next change.
   */
  async publish(slug: string): Promise<void> {
    if (!isBotConfigured()) return;

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
        const edited = await discordFetch(
          `/channels/${channelId}/messages/${event.discordMessageId}`,
          { method: 'PATCH', body: { embeds: [embed] } },
        );
        // The message was deleted in Discord: fall through and post a new one
        // rather than going silent forever.
        if (edited) return;
      }

      const posted = await discordFetch<{ id?: string }>(
        `/channels/${channelId}/messages`,
        { method: 'POST', body: { embeds: [embed] } },
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
