import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { DiscordNotifyService } from './notify.service';
import { PrismaService } from '../prisma/prisma.service';
import * as rest from './discord-rest';

jest.mock('./discord-rest', () => ({
  ...jest.requireActual<typeof import('./discord-rest')>('./discord-rest'),
  discordFetch: jest.fn(),
  isBotConfigured: jest.fn(() => true),
}));

const fetchMock = rest.discordFetch as jest.MockedFunction<
  typeof rest.discordFetch
>;
const configuredMock = rest.isBotConfigured as jest.MockedFunction<
  typeof rest.isBotConfigured
>;

describe('DiscordNotifyService', () => {
  let service: DiscordNotifyService;
  let prisma: {
    event: Record<string, jest.Mock>;
    barMembership: Record<string, jest.Mock>;
    bar: Record<string, jest.Mock>;
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    configuredMock.mockReturnValue(true);
    prisma = {
      event: { findUnique: jest.fn() },
      barMembership: { findMany: jest.fn() },
      bar: { findUnique: jest.fn() },
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        DiscordNotifyService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(DiscordNotifyService);
  });

  describe('announceEvent', () => {
    const event = {
      slug: 'apero',
      name: 'Apéro',
      date: '2026-09-12',
      bar: { id: 'bar-1', name: 'Chez Léa' },
    };

    it('counts who was reached, who failed, and who never linked', async () => {
      prisma.event.findUnique.mockResolvedValue(event);
      prisma.barMembership.findMany.mockResolvedValue([
        { user: { id: 'u1', discordUserId: '111' } },
        { user: { id: 'u2', discordUserId: '222' } },
        { user: { id: 'u3', discordUserId: null } }, // never linked
      ]);
      // u1: channel opens, message sends. u2: channel refuses (DMs closed).
      fetchMock
        .mockResolvedValueOnce({ id: 'dm-1' })
        .mockResolvedValueOnce({ id: 'msg-1' })
        .mockResolvedValueOnce(null);

      expect(await service.announceEvent('apero', 'host')).toEqual({
        sent: 1,
        failed: 1,
        unlinked: 1,
      });
    });

    it('does not message the person who pressed the button', async () => {
      prisma.event.findUnique.mockResolvedValue(event);
      prisma.barMembership.findMany.mockResolvedValue([
        { user: { id: 'host', discordUserId: '999' } },
      ]);

      expect(await service.announceEvent('apero', 'host')).toEqual({
        sent: 0,
        failed: 0,
        unlinked: 1,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports everyone as failed when the bot is not configured', async () => {
      configuredMock.mockReturnValue(false);
      prisma.event.findUnique.mockResolvedValue(event);
      prisma.barMembership.findMany.mockResolvedValue([
        { user: { id: 'u1', discordUserId: '111' } },
      ]);

      expect(await service.announceEvent('apero', 'host')).toEqual({
        sent: 0,
        failed: 1,
        unlinked: 0,
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('rejects an unknown soirée', async () => {
      prisma.event.findUnique.mockResolvedValue(null);
      await expect(service.announceEvent('nope', 'host')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createPoll', () => {
    it('refuses when the bar has no channel bound', async () => {
      prisma.bar.findUnique.mockResolvedValue({ discordChannelId: null });
      const res = await service.createPoll('bar-1', 'Où ?', ['A', 'B'], 24);
      expect(res.posted).toBe(false);
      expect(res.reason).toContain('Aucun salon');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses fewer than two usable answers', async () => {
      prisma.bar.findUnique.mockResolvedValue({ discordChannelId: 'chan' });
      // Blanks are dropped, which can leave a single real answer.
      const res = await service.createPoll(
        'bar-1',
        'Où ?',
        ['A', '   ', ''],
        24,
      );
      expect(res.posted).toBe(false);
      expect(res.reason).toContain('deux réponses');
    });

    it('caps the duration Discord accepts', async () => {
      prisma.bar.findUnique.mockResolvedValue({ discordChannelId: 'chan' });
      fetchMock.mockResolvedValue({ id: 'm' });

      await service.createPoll('bar-1', 'Où ?', ['A', 'B'], 99999);

      const body = fetchMock.mock.calls[0][1].body as {
        poll: { duration: number };
      };
      expect(body.poll.duration).toBe(768);
    });

    it('keeps at most the ten answers Discord allows', async () => {
      prisma.bar.findUnique.mockResolvedValue({ discordChannelId: 'chan' });
      fetchMock.mockResolvedValue({ id: 'm' });

      const many = Array.from({ length: 15 }, (_, i) => `Choix ${i}`);
      await service.createPoll('bar-1', 'Où ?', many, 24);

      const body = fetchMock.mock.calls[0][1].body as {
        poll: { answers: unknown[] };
      };
      expect(body.poll.answers).toHaveLength(10);
    });

    it('surfaces a refusal from Discord instead of claiming success', async () => {
      prisma.bar.findUnique.mockResolvedValue({ discordChannelId: 'chan' });
      fetchMock.mockResolvedValue(null);
      const res = await service.createPoll('bar-1', 'Où ?', ['A', 'B'], 24);
      expect(res.posted).toBe(false);
    });
  });
});
