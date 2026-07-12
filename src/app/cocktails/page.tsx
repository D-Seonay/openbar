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
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-zinc-800/80">
        <div>
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-400 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            <span>RECIPES_CORE // STUDIO DE MIXOLOGIE</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-zinc-100 tracking-tight">
            La Carte & Répertoire
          </h1>
        </div>
      </div>

      <CocktailStudio initialResults={results} isVip={isVip} />
    </PageTransition>
  );
}
