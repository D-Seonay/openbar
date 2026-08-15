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
import CalendarSubscribe from "./CalendarSubscribe";
import PaginationLinks from "@/components/PaginationLinks";
import { paginate } from "@/lib/pagination";
import { Badge, Button, Card, EmptyState, Field, Row, champClasses } from "@/components/ui";

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
  // A soirée whose date has gone by but which was never closed: the host still
  // owes it a bilan, and the stock is wrong until they do it. Compared on the
  // date string, which is stored as YYYY-MM-DD and therefore sorts correctly.
  const today = new Date().toISOString().slice(0, 10);
  const isOverdue = (event: (typeof sorted)[number]) => !event.isClosed && event.date < today;
  const overdue = sorted.filter(isOverdue);

  const activeEvents = paginate(sorted.filter((e) => !e.isClosed), page);
  const historyEvents = paginate(sorted.filter((e) => e.isClosed), histoire);

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <PageTransition className="space-y-8">
      <div>
        <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
          Organisation & Événements
        </span>
        <h1 className="font-display text-[27px] text-ink mt-1">Soirées Privées</h1>
        <p className="text-ink-soft text-[13px] mt-2 max-w-lg leading-relaxed">
          Planifiez vos soirées et générez des liens d&apos;invitation pour permettre à vos convives d&apos;indiquer ce qu&apos;ils apportent.
        </p>
      </div>

      {overdue.length > 0 && (
        <Card filet={false} className="border border-terracotta/30 space-y-3">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 shrink-0 rounded-xl bg-paper-sunk border border-rule text-terracotta flex items-center justify-center text-lg">
              ⏰
            </span>
            <div className="min-w-0">
              <h2 className="font-display text-[17px] text-ink">
                {overdue.length === 1
                  ? "Une soirée attend son bilan"
                  : `${overdue.length} soirées attendent leur bilan`}
              </h2>
              <p className="text-[13px] text-ink-soft mt-0.5 leading-relaxed">
                La date est passée mais la clôture n&apos;a pas été faite : le stock
                reste faux tant que le bilan n&apos;est pas validé.
              </p>
            </div>
          </div>

          <ul className="flex flex-wrap gap-2">
            {overdue.map((event) => (
              <li key={event.slug}>
                <Link
                  href={`/soirees/${event.slug}/bilan`}
                  className="tap-target inline-flex items-center gap-2 px-3 rounded-xl bg-paper-sunk border border-rule text-[13px] text-ink hover:border-terracotta hover:text-terracotta transition-colors"
                >
                  <span className="font-semibold">{event.name}</span>
                  <span className="text-[13px] text-ink-soft">
                    {new Date(event.date).toLocaleDateString("fr-FR", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="text-[13px] uppercase font-bold text-terracotta">
                    Faire le bilan →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="grid md:grid-cols-3 gap-6 items-start">
        {/* Create Event Card */}
        <Card className="md:col-span-1 min-w-0 space-y-4">
          <div>
            <h2 className="font-display text-[17px] text-ink">Créer un Événement</h2>
            <p className="text-ink-soft text-[13px] mt-0.5">Configurez une nouvelle date.</p>
          </div>
          <form action={createEvent.bind(null, activeBar.id)}>
            <Field label="Nom de la soirée" htmlFor="event-name">
              <input
                id="event-name"
                name="name"
                placeholder="Ex: Soirée Mojitos"
                required
                className={champClasses}
              />
            </Field>
            <Field label="Date" htmlFor="event-date">
              <input id="event-date" name="date" type="date" required className={champClasses} />
            </Field>
            <Button type="submit" pleineLargeur className="mt-1">
              Créer la soirée
            </Button>
          </form>
        </Card>

        <div className="md:col-span-1 min-w-0">
          <CalendarSubscribe />
        </div>

        {/* Events list */}
        {/* min-w-0 keeps this grid item from growing to the max-content width
            of a long, unbroken event name inside a nested `truncate` — a
            grid item's min-width defaults to `auto` (its content's min-content
            size), which otherwise silently stretches the whole single-column
            mobile grid — and every sibling in it — past the viewport. */}
        <section className="md:col-span-2 min-w-0 space-y-8">
          {/* Active Events */}
          <div className="space-y-3">
            <h2 id="en-cours" className="font-display text-[17px] text-ink">
              Événements en cours & à venir
            </h2>

            {activeEvents.totalItems === 0 ? (
              <EmptyState
                titre="Aucune soirée"
                message="Aucune soirée de planifiée pour le moment."
              />
            ) : (
              <div className="space-y-3">
                {activeEvents.items.map((event) => (
                  <Card key={event.slug} className="p-0 overflow-hidden">
                    <div className="px-4">
                      <Row
                        titre={event.name}
                        sousTitre={formatDate(event.date)}
                        droite={
                          isOverdue(event) ? <Badge ton="alerte">⏰ Bilan à faire</Badge> : undefined
                        }
                        href={`/soirees/${event.slug}`}
                        chevron
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-rule">
                      <CopyLink path={`/soirees/${event.slug}`} />
                      <ShareButton path={`/soirees/${event.slug}`} title={event.name} />
                      {/* Plain link, so the browser handles the download and the
                          phone offers to open it in its calendar app. */}
                      <a
                        href={`/soirees/${event.slug}/calendar`}
                        className="tap-target inline-flex items-center gap-1.5 px-2.5 rounded-lg border border-rule text-[13px] text-ink-soft font-medium hover:border-terracotta hover:text-terracotta transition-colors"
                        title="Ajouter à mon calendrier"
                      >
                        🗓️ Calendrier
                      </a>
                      <DeleteEventButton slug={event.slug} name={event.name} />
                    </div>
                  </Card>
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
            <div className="space-y-3">
              <h2 id="historique" className="font-display text-[17px] text-ink-soft">
                Historique des soirées clôturées
              </h2>

              <div className="space-y-3">
                {historyEvents.items.map((event) => (
                  <Card key={event.slug} className="p-0 overflow-hidden">
                    <div className="px-4">
                      <Row
                        titre={event.name}
                        sousTitre={formatDate(event.date)}
                        droite={<Badge ton="complet">✓ Bilan fait</Badge>}
                        href={`/soirees/${event.slug}`}
                        chevron
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-rule">
                      <DeleteEventButton slug={event.slug} name={event.name} />
                    </div>
                  </Card>
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
