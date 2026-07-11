import Link from "next/link";
import { listEvents } from "@/lib/db";
import { createEvent } from "@/app/actions";
import CopyLink from "./CopyLink";
import DeleteEventButton from "./DeleteEventButton";
import PageTransition from "@/components/PageTransition";

export default async function SoireesPage() {
  const events = await listEvents();
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

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
        <section className="bg-ink-2/40 border border-orange/10 p-6 rounded-xl box-orange-glow md:col-span-1 space-y-4">
          <div>
            <h2 className="font-display text-xl text-cream">Créer un Événement</h2>
            <p className="text-muted text-[11px] mt-0.5">Configurez une nouvelle date.</p>
          </div>
          <form action={createEvent} className="space-y-3.5">
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
            <div>
              <label className="text-[10px] uppercase tracking-wider text-muted mb-1 block">Convives VIP (Séparés par virgules)</label>
              <input
                name="vipNames"
                placeholder="Ex: Noa, Sarah, Thomas"
                className="w-full bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
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
        <section className="md:col-span-2 space-y-4">
          <div className="flex items-center gap-3 border-b border-orange/10 pb-2">
            <span className="w-1.5 h-3 bg-orange rounded-full" />
            <h2 className="font-display text-xl text-cream">Historique & Événements à venir</h2>
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-12 rounded-xl border border-dashed border-orange/10 bg-ink-2/20">
              <span className="text-3xl block mb-2">📅</span>
              <p className="text-muted text-sm">Aucune soirée de planifiée pour le moment.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {sorted.map((event) => (
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
                      {event.vipNames.length > 0 && (
                        <>
                          <span className="text-muted/40">•</span>
                          <span className="text-gold font-medium bg-brick-dark/30 px-2 py-0.5 rounded border border-gold/15 text-[9px] uppercase tracking-wider">
                            🔒 {event.vipNames.length} VIP
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-0 border-orange/5 pt-2 sm:pt-0 shrink-0">
                    <CopyLink path={`/soirees/${event.slug}`} />
                    <DeleteEventButton slug={event.slug} name={event.name} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </PageTransition>
  );
}

