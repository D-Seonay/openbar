import Link from "next/link";
import { redirect } from "next/navigation";
import { listEvents, listMyBars } from "@/lib/api-client";
import { createEvent } from "@/app/actions";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import CopyLink from "./CopyLink";
import ShareButton from "./ShareButton";
import DeleteEventButton from "./DeleteEventButton";
import PageTransition from "@/components/PageTransition";
import PaginationLinks from "@/components/PaginationLinks";
import { paginate } from "@/lib/pagination";

export default async function SoireesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; histoire?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/");

  const events = await listEvents(activeBar.id);
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

  // Two independent lists on one screen, so they get their own query
  // parameters: paging the history must not move the current soirées.
  const { page, histoire } = await searchParams;
  const activeEvents = paginate(sorted.filter((e) => !e.isClosed), page);
  const historyEvents = paginate(sorted.filter((e) => e.isClosed), histoire);

  return (
    <PageTransition className="space-y-8">
      <div>
        <span className="text-xs uppercase tracking-caps text-orange font-semibold">Organisation & Événements</span>
        <h1 className="font-display text-4xl sm:text-5xl font-bold text-cream mt-1 tracking-tight">Soirées Privées</h1>
        <p className="text-muted text-xs mt-2 max-w-lg leading-relaxed">
          Planifiez vos soirées et générez des liens d&apos;invitation pour permettre à vos convives d&apos;indiquer ce qu&apos;ils apportent.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        {/* Create Event Card */}
        <section className="bg-ink-2/40 border border-orange/10 p-5 sm:p-6 rounded-xl box-orange-glow md:col-span-1 space-y-4">
          <div>
            <h2 className="font-display text-xl text-cream">Créer un Événement</h2>
            <p className="text-muted text-[11px] mt-0.5">Configurez une nouvelle date.</p>
          </div>
          <form action={createEvent.bind(null, activeBar.id)} className="space-y-3.5">
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted mb-1 block">Nom de la soirée</label>
              <input
                name="name"
                placeholder="Ex: Soirée Mojitos"
                required
                className="w-full bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted mb-1 block">Date</label>
              <input
                name="date"
                type="date"
                required
                className="w-full bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-orange text-white font-medium rounded-xl py-2.5 hover:bg-orange-hover box-orange-glow transition-all text-xs uppercase tracking-wider font-semibold"
            >
              Créer la soirée
            </button>
          </form>
        </section>

        {/* Events list */}
        <section className="md:col-span-2 space-y-8">
          {/* Active Events */}
          <div className="space-y-4">
            <div id="en-cours" className="flex items-center gap-3 border-b border-orange/10 pb-2">
              <span className="w-1.5 h-3 bg-orange rounded-full" />
              <h2 className="font-display text-xl text-cream">Événements en cours & à venir</h2>
            </div>

            {activeEvents.totalItems === 0 ? (
              <div className="text-center py-8 rounded-xl border border-dashed border-orange/10 bg-ink-2/20">
                <span className="text-2xl block mb-2">📅</span>
                <p className="text-muted text-sm">Aucune soirée de planifiée pour le moment.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {activeEvents.items.map((event) => (
                  <div
                    key={event.slug}
                    className="rounded-xl border border-orange/10 bg-ink-2/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-orange/20 transition-all box-orange-glow-hover"
                  >
                    <div>
                      <Link href={`/soirees/${event.slug}`} className="font-display text-lg text-cream hover:text-orange transition-colors">
                        {event.name}
                      </Link>
                      <p className="text-xs text-muted mt-1 flex flex-wrap gap-2 items-center">
                        <span className="text-orange-dim capitalize font-mono text-[10px]">
                          {new Date(event.date).toLocaleDateString("fr-FR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 border-t sm:border-0 border-orange/5 pt-3 sm:pt-0 shrink-0">
                      <CopyLink path={`/soirees/${event.slug}`} />
                      <ShareButton path={`/soirees/${event.slug}`} title={event.name} />
                      <DeleteEventButton slug={event.slug} name={event.name} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <PaginationLinks
              currentPage={activeEvents.currentPage}
              totalPages={activeEvents.totalPages}
              basePath="/soirees"
              anchor="en-cours"
              currentParams={{ page, histoire }}
            />
          </div>

          {/* History Events */}
          {historyEvents.totalItems > 0 && (
            <div className="space-y-4">
              <div id="historique" className="flex items-center gap-3 border-b border-white/[0.08] pb-2">
                <span className="w-1.5 h-3 bg-white/[0.2] rounded-full" />
                <h2 className="font-display text-xl text-muted">Historique des soirées clôturées</h2>
              </div>

              <div className="grid gap-3">
                {historyEvents.items.map((event) => (
                  <div
                    key={event.slug}
                    className="rounded-xl border border-white/[0.05] bg-ink/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 opacity-70 hover:opacity-100 transition-opacity"
                  >
                    <div>
                      <Link href={`/soirees/${event.slug}`} className="font-display text-lg text-cream hover:text-orange transition-colors">
                        {event.name}
                      </Link>
                      <p className="text-xs text-muted mt-1 flex flex-wrap gap-2 items-center">
                        <span className="capitalize font-mono text-[10px]">
                          {new Date(event.date).toLocaleDateString("fr-FR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.05] text-white/50 border border-white/[0.1] font-bold">
                          ✓ Bilan fait
                        </span>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 border-t sm:border-0 border-white/[0.05] pt-3 sm:pt-0 shrink-0">
                      <Link
                        href={`/soirees/${event.slug}`}
                        className="tap-target-sm flex items-center text-[10px] uppercase font-bold text-muted hover:text-cream px-3 py-1.5 rounded-lg bg-white/[0.05] transition-colors"
                      >
                        Consulter
                      </Link>
                      <DeleteEventButton slug={event.slug} name={event.name} />
                    </div>
                  </div>
                ))}
              </div>

              <PaginationLinks
                currentPage={historyEvents.currentPage}
                totalPages={historyEvents.totalPages}
                basePath="/soirees"
                param="histoire"
                anchor="historique"
                currentParams={{ page, histoire }}
              />
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}

