import { evaluateCocktails } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import CocktailStudio from "./CocktailStudio";
import PageTransition from "@/components/PageTransition";

export default async function CocktailsPage() {
  const [results, session] = await Promise.all([
    evaluateCocktails(),
    getSession(),
  ]);

  const isVip = Boolean(session?.vip || session?.role === "ADMIN");

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-orange/15">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
            <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
            <span>Mixologie & Recettes</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
            La Carte des Cocktails
          </h1>
        </div>
      </div>

      <CocktailStudio initialResults={results} isVip={isVip} />
    </PageTransition>
  );
}
