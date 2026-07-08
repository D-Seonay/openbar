import { listBottles } from "@/lib/db";
import { evaluateRecipes } from "@/lib/cocktails";
import CocktailGrid from "./CocktailGrid";

export default async function CocktailsPage() {
  const bottles = await listBottles();
  const results = evaluateRecipes(bottles);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">Mixologie & Recettes</span>
          <h1 className="font-display text-4xl text-cream mt-1">La Carte des Cocktails</h1>
          <p className="text-muted text-xs mt-2 max-w-lg leading-relaxed">
            Consultez le menu de cocktails calculé en temps réel selon les ingrédients actuellement disponibles à votre bar.
          </p>
        </div>
      </div>

      <CocktailGrid initialResults={results} />
    </div>
  );
}
