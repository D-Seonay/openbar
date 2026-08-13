import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession, SESSION_COOKIE } from "@/lib/session";
import { getBaseApiUrl } from "@/lib/api";
import { DISCORD_STATE_COOKIE, verifyState } from "@/lib/discord";

/**
 * Discord sends the user back here with a one-time code.
 *
 * The code is forwarded to the API, which owns the client secret — the web
 * container never holds it. Every outcome ends in a redirect to /profil with a
 * short reason, so the user always lands somewhere that explains itself.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) redirect("/login?redirectTo=/profil");

  const url = new URL(request.url);
  const jar = await cookies();
  const stored = jar.get(DISCORD_STATE_COOKIE)?.value;
  // One shot: consumed whatever happens next.
  jar.delete(DISCORD_STATE_COOKIE);

  // Discord reports a refusal here rather than by failing the exchange.
  if (url.searchParams.get("error")) redirect("/profil?discord=refus");

  if (!verifyState(url.searchParams.get("state") ?? undefined, stored)) {
    redirect("/profil?discord=etat");
  }

  const code = url.searchParams.get("code");
  if (!code) redirect("/profil?discord=erreur");

  const token = jar.get(SESSION_COOKIE)?.value;
  const res = await fetch(`${getBaseApiUrl()}/auth/discord/link`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}),
    },
    body: JSON.stringify({ code }),
    cache: "no-store",
  });

  if (res.status === 409) redirect("/profil?discord=deja-lie");
  if (!res.ok) redirect("/profil?discord=erreur");
  redirect("/profil?discord=ok");
}
