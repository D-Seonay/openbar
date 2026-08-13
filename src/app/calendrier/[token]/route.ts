import { getBaseApiUrl } from "@/lib/api";

/**
 * Public subscription feed, proxied so the URL a user hands to Google or Apple
 * lives on the app's own origin rather than exposing the API.
 *
 * No session check: calendar clients poll without cookies, so the secret in the
 * path is the credential — the API resolves the token and refuses if unknown.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/calendrier/[token]">,
) {
  const { token } = await ctx.params;

  const upstream = await fetch(
    `${getBaseApiUrl()}/calendar/${encodeURIComponent(token)}.ics`,
    { cache: "no-store" },
  );
  if (!upstream.ok) {
    return new Response("Calendrier introuvable.", { status: upstream.status });
  }

  return new Response(await upstream.text(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
