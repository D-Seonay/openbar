import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/session";
import { getBaseApiUrl } from "@/lib/api";

/**
 * Streams the soirée's "download everything" zip from the Nest API.
 *
 * A download cannot go through a server action — the browser has to receive the
 * bytes itself — and the API is not reachable from the browser (it has no
 * published port). So this route handler stands in: it runs on the server,
 * forwards the httpOnly session cookie, and pipes the response body straight
 * back without buffering, so a multi-gigabyte gallery never lands in memory.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/soirees/[slug]/media/archive">,
) {
  const { slug } = await ctx.params;

  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) {
    return new Response("Non authentifié", { status: 401 });
  }

  const upstream = await fetch(
    `${getBaseApiUrl()}/events/${encodeURIComponent(slug)}/media/archive`,
    {
      headers: { Cookie: `${SESSION_COOKIE}=${token}` },
      cache: "no-store",
    },
  );

  if (!upstream.ok || !upstream.body) {
    // The API already answers in French for the cases a guest can hit
    // (no files yet, not a member of this bar).
    const message = await upstream
      .json()
      .then((body: { message?: string }) => body.message)
      .catch(() => null);
    return new Response(message ?? "Téléchargement impossible.", {
      status: upstream.status,
    });
  }

  return new Response(upstream.body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "application/zip",
      "Content-Disposition":
        upstream.headers.get("content-disposition") ??
        `attachment; filename="${slug}.zip"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
