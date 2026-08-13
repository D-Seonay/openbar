import { Logger } from '@nestjs/common';

const API_BASE = process.env.DISCORD_API_BASE ?? 'https://discord.com/api/v10';

/** Everything here sits behind a user action, so nothing may hang a request. */
const TIMEOUT_MS = 6000;

/**
 * Discord answers 429 with how long to wait. Retrying is worth it — opening a
 * DM channel is one of its most rate-limited endpoints, and without this a
 * burst is reported to the host as "unreachable", which is simply false.
 */
const MAX_RETRIES = 3;

/** Past this, waiting costs more than the message is worth. */
const MAX_RETRY_WAIT_MS = 5000;

interface RateLimit {
  retry_after?: number;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
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

      if (res.status === 429 && attempt < MAX_RETRIES) {
        // The body carries seconds as a float; the header is the fallback.
        const body = (await res.json().catch(() => ({}))) as RateLimit;
        const headerSeconds = Number(res.headers.get('retry-after'));
        const seconds =
          body.retry_after ??
          (Number.isFinite(headerSeconds) ? headerSeconds : 1);
        const waitMs = Math.min(Math.ceil(seconds * 1000), MAX_RETRY_WAIT_MS);
        logger.warn(
          `Discord ${init.method} ${path} → 429, nouvelle tentative dans ${waitMs}ms`,
        );
        clearTimeout(timeout);
        await sleep(waitMs);
        continue;
      }

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

  logger.warn(
    `Discord ${init.method} ${path} : abandon après ${MAX_RETRIES} 429`,
  );
  return null;
}
