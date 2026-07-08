import { notFound } from "next/navigation";
import { getEvent, listBottles } from "@/lib/db";
import { evaluateRecipes } from "@/lib/cocktails";
import { submitBilan } from "@/app/actions";

export default async function BilanPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const bottles = await listBottles();
  const availability = evaluateRecipes(bottles);
  const vipTagsUsed = new Set(
    availability.filter((a) => a.makeable && a.usesVip).flatMap((a) => a.recipe.tags)
  );
  const relevant = bottles.filter((b) => !b.vip || b.tags.some((t) => vipTagsUsed.has(t)));

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs uppercase tracking-caps text-gold-dim mb-2">Bilan</p>
        <h1 className="font-display text-4xl text-gold">{event.name}</h1>
        <p className="text-muted text-sm mt-2 max-w-lg">
          Ajuste les quantités restantes pour les bouteilles concernées par cette soirée. Laisse
          inchangé ce qui n&apos;a pas bougé.
        </p>
      </div>

      <form action={submitBilan.bind(null, slug)} className="space-y-6">
        <div className="rounded-xl border border-cream/10 bg-ink-2 p-6 space-y-3">
          {relevant.length === 0 ? (
            <p className="text-muted text-sm">Aucune bouteille à ajuster.</p>
          ) : (
            relevant.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-4 border-b border-cream/10 pb-3 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-cream font-medium">{b.name}</p>
                  <p className="text-xs text-muted">Actuellement : {b.quantity}</p>
                </div>
                <input
                  type="number"
                  name={`quantity-${b.id}`}
                  step="0.5"
                  min="0"
                  defaultValue={b.quantity}
                  className="w-24 bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm text-right focus:outline-none focus:border-gold/60"
                />
              </div>
            ))
          )}
        </div>
        <button
          type="submit"
          className="bg-gold text-ink font-medium rounded-lg px-6 py-2 hover:bg-cream transition-colors"
        >
          Valider le bilan
        </button>
      </form>
    </div>
  );
}
