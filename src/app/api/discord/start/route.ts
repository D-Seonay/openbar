import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import {
  DISCORD_STATE_COOKIE,
  authorizeUrl,
  createState,
  isDiscordConfigured,
} from "@/lib/discord";

/** Begin the link: mint a CSRF state, drop it in a cookie, bounce to Discord. */
export async function GET() {
  const session = await getSession();
  if (!session) redirect("/login?redirectTo=/profil");

  if (!isDiscordConfigured()) {
    return new Response("L'intégration Discord n'est pas configurée.", { status: 503 });
  }

  const state = createState();
  (await cookies()).set(DISCORD_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    // Long enough to authorise, short enough not to linger.
    maxAge: 600,
    path: "/",
  });

  redirect(authorizeUrl(state));
}
