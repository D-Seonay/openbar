import Link from "next/link";
import { listEvents } from "@/lib/db";
import { createEvent, deleteEventAction } from "@/app/actions";
import CopyLink from "./CopyLink";

export default async function SoireesPage() {
  const events = await listEvents();
  const sorted = [...events].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-caps text-gold-dim mb-2">Organisation</p>
        <h1 className="font-display text-4xl text-gold">Soirées</h1>
        <p className="text-muted text-sm mt-2 max-w-lg">
          Crée une soirée, envoie le lien à tes invités pour qu&apos;ils indiquent ce qu&apos;ils ramènent.
        </p>
      </div>

      <section className="rounded-xl border border-cream/10 bg-ink-2 p-6">
        <h2 className="font-display text-xl text-cream mb-4">Nouvelle soirée</h2>
        <form action={createEvent} className="grid sm:grid-cols-2 gap-3">
          <input
            name="name"
            placeholder="Nom de la soirée (ex: Apéro du samedi)"
            required
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm sm:col-span-2 placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
          <input
            name="date"
            type="date"
            required
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold/60"
          />
          <input
            name="vipNames"
            placeholder="Prénoms VIP, séparés par des virgules (optionnel)"
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
          <button
            type="submit"
            className="sm:col-span-2 bg-gold text-ink font-medium rounded-lg py-2 hover:bg-cream transition-colors"
          >
            Créer la soirée
          </button>
        </form>
      </section>

      <section>
        <h2 className="font-display text-xl text-cream mb-4">Toutes les soirées</h2>
        {sorted.length === 0 ? (
          <p className="text-muted text-sm">Aucune soirée pour l&apos;instant.</p>
        ) : (
          <div className="space-y-3">
            {sorted.map((event) => (
              <div
                key={event.slug}
                className="rounded-xl border border-cream/10 bg-ink-2 p-4 flex items-center justify-between gap-4"
              >
                <div>
                  <Link href={`/soirees/${event.slug}`} className="font-display text-lg text-cream hover:text-gold">
                    {event.name}
                  </Link>
                  <p className="text-xs text-muted mt-0.5">
                    {new Date(event.date).toLocaleDateString("fr-FR", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                    {event.vipNames.length > 0 && (
                      <span className="text-gold"> · {event.vipNames.length} VIP</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <CopyLink path={`/soirees/${event.slug}`} />
                  <form action={deleteEventAction.bind(null, event.slug)}>
                    <button className="text-xs text-muted hover:text-red-400">Supprimer</button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
