import { listBottles } from "@/lib/db";
import { evaluateRecipes, type RecipeAvailability } from "@/lib/cocktails";

export default async function CocktailsPage() {
  const bottles = await listBottles();
  const results = evaluateRecipes(bottles);

  const ready = results.filter((r) => r.makeable && !r.usesVip);
  const vipReady = results.filter((r) => r.makeable && r.usesVip);
  const notReady = results
    .filter((r) => !r.makeable)
    .sort((a, b) => a.missingTags.length - b.missingTags.length);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-caps text-gold-dim mb-2">Carte</p>
        <h1 className="font-display text-4xl text-gold">Cocktails</h1>
        <p className="text-muted text-sm mt-2">
          Calculé automatiquement à partir de ton stock (alcools + mixers).
        </p>
      </div>

      <RecipeSection
        title={`Réalisables maintenant (${ready.length})`}
        items={ready}
        emptyText="Ajoute des bouteilles et des mixers dans le stock pour débloquer des cocktails."
      />

      {vipReady.length > 0 && (
        <RecipeSection
          title={`Réserve VIP (${vipReady.length})`}
          items={vipReady}
          accent
        />
      )}

      {notReady.length > 0 && (
        <section>
          <h2 className="font-display text-xl text-cream mb-4">Encore un peu de shopping</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {notReady.slice(0, 8).map(({ recipe, missingTags }) => (
              <div key={recipe.id} className="rounded-lg border border-cream/10 bg-ink-2 p-3 text-sm">
                <p className="font-medium text-cream">{recipe.name}</p>
                <p className="text-muted text-xs mt-1">
                  Il manque : {missingTags.join(", ")}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function RecipeSection({
  title,
  items,
  emptyText,
  accent,
}: {
  title: string;
  items: RecipeAvailability[];
  emptyText?: string;
  accent?: boolean;
}) {
  return (
    <section
      className={accent ? "rounded-xl border border-gold/25 bg-brick-dark/40 p-6" : undefined}
    >
      <h2 className={`font-display text-xl mb-4 ${accent ? "text-gold" : "text-cream"}`}>{title}</h2>
      {items.length === 0 && emptyText ? (
        <p className="text-muted text-sm">{emptyText}</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {items.map(({ recipe }) => (
            <div
              key={recipe.id}
              className={`rounded-xl p-4 ${
                accent ? "border border-gold/20 bg-ink/20" : "border border-cream/10 bg-ink-2"
              }`}
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-display text-lg text-cream">{recipe.name}</h3>
                {recipe.glass && <span className="text-xs text-gold-dim">{recipe.glass}</span>}
              </div>
              <p className="text-xs text-gold-dim mt-1 tracking-wide">{recipe.tags.join(" · ")}</p>
              <p className="text-sm text-muted mt-2">{recipe.instructions}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
