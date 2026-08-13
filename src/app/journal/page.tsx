import { redirect } from "next/navigation";
import { listMyBars, listBarAudit } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import PageTransition from "@/components/PageTransition";
import PaginationLinks from "@/components/PaginationLinks";

/** Groups entries under a day heading, so a busy evening reads as one block. */
function dayLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ICONS: Record<string, string> = {
  "bottle.create": "🍾",
  "bottle.update": "✏️",
  "bottle.delete": "🗑️",
  "event.create": "📅",
  "event.delete": "🗑️",
  "stock.bilan": "📊",
};

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/");

  const isOwner = session.role === "ADMIN" || activeBar.myRole === "OWNER";
  if (!isOwner) redirect("/");

  const parsed = Number((await searchParams).page);
  const page = Number.isFinite(parsed) ? Math.max(Math.trunc(parsed), 1) : 1;
  const journal = await listBarAudit(activeBar.id, page);

  const totalPages = Math.max(1, Math.ceil(journal.total / (journal.pageSize || 20)));

  // Entries arrive newest first, so grouping in order keeps the days in order.
  const days = new Map<string, typeof journal.entries>();
  for (const entry of journal.entries) {
    const key = dayLabel(entry.createdAt);
    const bucket = days.get(key);
    if (bucket) bucket.push(entry);
    else days.set(key, [entry]);
  }

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-orange/15">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>{activeBar.name}</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
            Journal du bar
          </h1>
          <p className="text-muted text-xs mt-2 max-w-lg leading-relaxed">
            Qui a fait quoi, du plus récent au plus ancien.
          </p>
        </div>
        <span className="shrink-0 text-xs font-mono font-bold text-orange bg-orange/15 px-3 py-1 rounded-full border border-orange/30">
          {journal.total} entrée{journal.total !== 1 ? "s" : ""}
        </span>
      </div>

      {journal.entries.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-ink-2/40 border border-dashed border-white/[0.08]">
          <p className="text-3xl mb-2">📖</p>
          <p className="text-muted text-xs italic">
            Rien encore. Les ajouts, retraits et bilans apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...days.entries()].map(([day, entries]) => (
            <section key={day} className="space-y-2">
              <h2 className="text-[10px] uppercase tracking-caps text-gold-dim font-bold capitalize">
                {day}
              </h2>
              <ul className="rounded-2xl border border-white/[0.08] bg-ink-2/60 divide-y divide-white/[0.06] overflow-hidden">
                {entries.map((entry) => (
                  <li
                    key={entry.id}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="w-8 h-8 shrink-0 rounded-lg bg-ink border border-white/[0.08] flex items-center justify-center text-sm">
                      {ICONS[entry.action] ?? "•"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-cream break-words">
                        <span className="font-semibold">{entry.actorName}</span>{" "}
                        <span className="text-muted">{entry.summary}</span>
                      </p>
                      <p className="text-[10px] text-muted/70 font-mono mt-0.5">
                        {timeLabel(entry.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <PaginationLinks
        currentPage={journal.page}
        totalPages={totalPages}
        basePath="/journal"
      />
    </PageTransition>
  );
}
