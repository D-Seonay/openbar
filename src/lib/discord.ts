import { createHmac, randomBytes, timingSafeEqual } from "crypto";

export const DISCORD_STATE_COOKIE = "bardenoa_discord_state";

const CLIENT_ID = process.env.DISCORD_CLIENT_ID ?? "";
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI ?? "";

export function isDiscordConfigured(): boolean {
  return Boolean(CLIENT_ID && REDIRECT_URI);
}

/**
 * Sign the CSRF state with the app's own secret.
 *
 * Without a state bound to this browser, anyone could send a victim a crafted
 * callback URL carrying *their* Discord code and silently attach their Discord
 * account to the victim's profile. The value is stored in a cookie and checked
 * on return.
 */
function secret(): string {
  return process.env.JWT_SECRET ?? "dev-secret-change-me";
}

export function createState(): string {
  const nonce = randomBytes(16).toString("base64url");
  const mac = createHmac("sha256", secret()).update(nonce).digest("base64url");
  return `${nonce}.${mac}`;
}

export function verifyState(candidate: string | undefined, cookie: string | undefined): boolean {
  if (!candidate || !cookie || candidate !== cookie) return false;

  const [nonce, mac] = candidate.split(".");
  if (!nonce || !mac) return false;

  const expected = createHmac("sha256", secret()).update(nonce).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  // Lengths must match before timingSafeEqual, which throws otherwise.
  return a.length === b.length && timingSafeEqual(a, b);
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    // `identify` only: enough to read the account id, and nothing more. No
    // guild list, no email, no ability to act on the account.
    scope: "identify",
    state,
    prompt: "consent",
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
