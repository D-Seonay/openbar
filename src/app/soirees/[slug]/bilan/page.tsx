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
        <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">Bilan de fin de soirée</span>
        <h1 className="font-display text-4xl text-cream mt-1">{event.name}</h1>
        <p className="text-muted text-xs mt-2 max-w-lg leading-relaxed">
          Ajustez les volumes restants pour les bouteilles consommées durant cette soirée. Les stocks inchangés conserveront leurs valeurs.
        </p>
      </div>

      <form action={submitBilan.bind(null, slug)} className="space-y-6">
        <div className="rounded-xl border border-orange/10 bg-ink-2/40 p-6 space-y-4 box-orange-glow">
          {relevant.length === 0 ? (
            <p className="text-muted text-xs italic text-center py-4">Aucune bouteille à ajuster.</p>
          ) : (
            relevant.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between gap-4 border-b border-orange/5 pb-4 last:border-0 last:pb-0"
              >
                <div>
                  <p className="text-cream font-medium text-sm">{b.name}</p>
                  <p className="text-xs text-muted/65">Volume actuel : {b.quantity}</p>
                </div>
                <input
                  type="number"
                  name={`quantity-${b.id}`}
                  step="0.5"
                  min="0"
                  defaultValue={b.quantity}
                  className="w-24 bg-ink border border-orange/15 rounded-xl px-3 py-2 text-xs text-right focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
                />
              </div>
            ))
          )}
        </div>
        <button
          type="submit"
          className="w-full bg-orange text-white font-medium rounded-xl py-3 hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider text-xs font-semibold"
        >
          Valider et clore l&apos;événement
        </button>
      </form>
    </div>
  );
}
