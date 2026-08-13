import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { getBaseApiUrl } from "@/lib/api";

/**
 * Proxies one soirée's .ics from the API, which the browser cannot reach.
 * Same pattern as the media archive: a download has to arrive at the browser,
 * so it cannot go through a server action.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/soirees/[slug]/calendar">,
) {
  const { slug } = await ctx.params;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return new Response("Non authentifié", { status: 401 });

  const upstream = await fetch(
    `${getBaseApiUrl()}/events/${encodeURIComponent(slug)}/calendar.ics`,
    { headers: { Cookie: `${SESSION_COOKIE}=${token}` }, cache: "no-store" },
  );
  if (!upstream.ok) {
    return new Response("Calendrier indisponible.", { status: upstream.status });
  }

  return new Response(await upstream.text(), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
