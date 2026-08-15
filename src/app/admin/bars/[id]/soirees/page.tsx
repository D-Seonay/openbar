import { redirect } from "next/navigation";
import { getBarById, listEvents } from "@/lib/api-client";
import { createEvent } from "@/app/actions";
import { getSession } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import CopyLink from "@/app/soirees/CopyLink";
import DeleteEventButton from "@/app/soirees/DeleteEventButton";
import { Button, Card, Field, Row, champClasses } from "@/components/ui";

export default async function AdminBarSoireesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;
  const [bar, events] = await Promise.all([getBarById(id), listEvents(id)]);
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-rule">
        <div className="inline-flex items-center gap-2 text-[13px] font-bold uppercase tracking-caps text-terracotta mb-2">
          <span className="w-2 h-2 rounded-full bg-terracotta animate-pulse" />
          <span>Espace Administrateur</span>
        </div>
        <h1 className="font-display text-[27px] text-ink mt-1">
          Soirées de {bar.name}
        </h1>
      </div>

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <Card className="md:col-span-1 space-y-4">
          <div>
            <h2 className="font-display text-[17px] text-ink">Créer un Événement</h2>
            <p className="text-ink-soft text-[13px] mt-0.5">Configurez une nouvelle date.</p>
          </div>
          <form action={createEvent.bind(null, id)}>
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

        <section className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-3 border-b border-rule pb-2">
            <span className="w-1.5 h-3 bg-terracotta rounded-full" />
            <h2 className="font-display text-[17px] text-ink">Historique & Événements à venir</h2>
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-rule bg-paper-sunk">
              <span className="text-3xl block mb-2">📅</span>
              <p className="text-ink-soft text-[15px]">Aucune soirée de planifiée pour le moment.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sorted.map((event) => (
                <Card key={event.slug} className="p-0 overflow-hidden">
                  <div className="px-4">
                    <Row
                      titre={event.name}
                      sousTitre={formatDate(event.date)}
                      href={`/soirees/${event.slug}`}
                      chevron
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 border-t border-rule">
                    <CopyLink path={`/soirees/${event.slug}`} />
                    <DeleteEventButton slug={event.slug} name={event.name} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}
