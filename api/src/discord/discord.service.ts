import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Overridable so tests can point the exchange at a local stub. The real value
 * is Discord's own API; nothing else should ever set this in production.
 */
const API_BASE = process.env.DISCORD_API_BASE ?? 'https://discord.com/api/v10';
const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? '';
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET ?? '';
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI ?? '';

/** The exchange sits on a user-facing redirect, so it must not hang. */
const TIMEOUT_MS = 8000;

interface DiscordTokenResponse {
  access_token?: string;
}

interface DiscordUser {
  id?: string;
  username?: string;
  global_name?: string | null;
}

@Injectable()
export class DiscordService {
  private readonly logger = new Logger(DiscordService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** False when the app was deployed without Discord configured. */
  isConfigured(): boolean {
    return Boolean(CLIENT_ID && CLIENT_SECRET && REDIRECT_URI);
  }

  private async post<T>(
    path: string,
    body: URLSearchParams,
  ): Promise<T | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as T;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async getMe(accessToken: string): Promise<DiscordUser | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(`${API_BASE}/users/@me`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as DiscordUser;
    } catch {
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Trade the one-time code for the Discord identity and attach it.
   *
   * The access token is used once and never stored: linking only needs the
   * account id, and keeping a token would mean holding a credential that can
   * act on someone's Discord account for no benefit.
   */
  async link(userId: string, code: string) {
    if (!this.isConfigured()) {
      throw new ServiceUnavailableException(
        "L'intégration Discord n'est pas configurée",
      );
    }

    const token = await this.post<DiscordTokenResponse>(
      '/oauth2/token',
      new URLSearchParams({
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    );
    if (!token?.access_token) {
      throw new BadRequestException('Discord a refusé le code de liaison');
    }

    const me = await this.getMe(token.access_token);
    if (!me?.id) {
      throw new BadRequestException('Impossible de lire le compte Discord');
    }

    try {
      return await this.prisma.user.update({
        where: { id: userId },
        data: {
          discordUserId: me.id,
          discordUsername: me.global_name || me.username || null,
        },
        select: { discordUserId: true, discordUsername: true },
      });
    } catch (error) {
      // The unique index rejects attaching one Discord account to a second
      // profile, which would otherwise silently redirect someone's soirées.
      if ((error as { code?: string }).code === 'P2002') {
        throw new ConflictException(
          'Ce compte Discord est déjà lié à un autre profil OpenBar',
        );
      }
      this.logger.warn(`Liaison Discord échouée : ${String(error)}`);
      throw error;
    }
  }

  async unlink(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { discordUserId: null, discordUsername: null },
    });
    return { success: true };
  }
}
