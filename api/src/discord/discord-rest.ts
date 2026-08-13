import { Logger } from '@nestjs/common';

const API_BASE = process.env.DISCORD_API_BASE ?? 'https://discord.com/api/v10';

/** Everything here sits behind a user action, so nothing may hang a request. */
const TIMEOUT_MS = 6000;

const logger = new Logger('DiscordRest');

export function botToken(): string {
  return process.env.DISCORD_BOT_TOKEN ?? '';
}

export function isBotConfigured(): boolean {
  return Boolean(botToken());
}

/**
 * One place that talks to Discord's REST API.
 *
 * Returns `null` on every failure rather than throwing: every caller is a
 * best-effort side effect on top of an action that has already succeeded, and
 * none of them should be able to turn a working click into an error.
 */
export async function discordFetch<T>(
  path: string,
  init: { method: 'GET' | 'POST' | 'PATCH'; body?: unknown },
): Promise<T | null> {
  const token = botToken();
  if (!token) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: init.method,
      headers: {
        Authorization: `Bot ${token}`,
        'Content-Type': 'application/json',
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
    if (!res.ok) {
      logger.warn(`Discord ${init.method} ${path} → ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (error) {
    logger.warn(`Discord ${init.method} ${path} : ${String(error)}`);
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
