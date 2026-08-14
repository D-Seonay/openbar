import { redirect } from "next/navigation";
import { listMyBars, listBarAudit } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import PageTransition from "@/components/PageTransition";
import PaginationLinks from "@/components/PaginationLinks";
import { Badge, Row } from "@/components/ui";

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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-rule">
        <div>
          <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
            {activeBar.name}
          </span>
          <h1 className="font-display text-[27px] text-ink mt-1">
            Journal du bar
          </h1>
          <p className="text-ink-soft text-[13px] mt-2 max-w-lg leading-relaxed">
            Qui a fait quoi, du plus récent au plus ancien.
          </p>
        </div>
        <Badge>
          {journal.total} entrée{journal.total !== 1 ? "s" : ""}
        </Badge>
      </div>

      {journal.entries.length === 0 ? (
        <div className="text-center py-12 rounded-2xl bg-paper-sunk border border-dashed border-rule">
          <p className="text-3xl mb-2">📖</p>
          <p className="text-ink-soft text-[13px] italic">
            Rien encore. Les ajouts, retraits et bilans apparaîtront ici.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {[...days.entries()].map(([day, entries]) => (
            <section key={day} className="space-y-2">
              <h2 className="text-[13px] uppercase tracking-caps text-ink-soft font-bold capitalize">
                {day}
              </h2>
              <div className="rounded-2xl border border-rule bg-paper overflow-hidden">
                {entries.map((entry) => (
                  <div key={entry.id} className="px-4">
                    <Row
                      titre={
                        <span className="flex items-center gap-3 min-w-0">
                          <span className="w-8 h-8 shrink-0 rounded-lg bg-paper-sunk border border-rule flex items-center justify-center text-[15px]">
                            {ICONS[entry.action] ?? "•"}
                          </span>
                          <span className="truncate min-w-0">
                            {entry.actorName}{" "}
                            <span className="font-normal text-ink-soft">{entry.summary}</span>
                          </span>
                        </span>
                      }
                      sousTitre={timeLabel(entry.createdAt)}
                    />
                  </div>
                ))}
              </div>
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
