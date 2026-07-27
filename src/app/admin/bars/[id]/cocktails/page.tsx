import { redirect } from "next/navigation";
import { getBarById, evaluateCocktails, listBottles } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import PageTransition from "@/components/PageTransition";
import CocktailStudio from "@/app/cocktails/CocktailStudio";

export default async function AdminBarCocktailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (session?.role !== "ADMIN") {
    redirect("/login");
  }

  const { id } = await params;
  const [bar, results, bottles] = await Promise.all([
    getBarById(id),
    evaluateCocktails(id),
    listBottles(id),
  ]);

  const allTags = Array.from(new Set(bottles.flatMap((b) => b.tags))).sort();

  return (
    <PageTransition className="space-y-8">
      <div className="pb-6 border-b border-orange/15">
        <div className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-caps text-gold mb-2">
          <span className="w-2 h-2 rounded-full bg-orange animate-pulse" />
          <span>Espace Administrateur</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-cream tracking-tight">
          Cocktails de {bar.name}
        </h1>
      </div>

      <CocktailStudio
        initialResults={results}
        isVip
        currentUserId={session.sub}
        isAdmin
        allTags={allTags}
        barId={id}
      />
    </PageTransition>
  );
}
