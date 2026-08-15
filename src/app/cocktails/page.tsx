import { redirect } from "next/navigation";
import { evaluateCocktails, listBottles, listMyBars } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { resolveActiveBar } from "@/lib/active-bar";
import CocktailStudio from "./CocktailStudio";
import PageTransition from "@/components/PageTransition";

export default async function CocktailsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const bars = await listMyBars();
  const activeBar = await resolveActiveBar(bars);
  if (!activeBar) redirect("/");

  const [results, bottles] = await Promise.all([
    evaluateCocktails(activeBar.id),
    listBottles(activeBar.id),
  ]);

  const isVip = Boolean(session.vip || session.role === "ADMIN" || activeBar.myVip);
  const isAdmin = session.role === "ADMIN";
  const allTags = Array.from(new Set(bottles.flatMap((b) => b.tags))).sort();

  return (
    <PageTransition className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-rule">
        <div>
          <span className="text-[13px] uppercase tracking-caps text-terracotta font-semibold">
            Mixologie & Recettes
          </span>
          <h1 className="font-display text-[27px] text-ink mt-1">La Carte des Cocktails</h1>
        </div>
      </div>

      <CocktailStudio
        initialResults={results}
        isVip={isVip}
        currentUserId={session.sub}
        isAdmin={isAdmin}
        allTags={allTags}
        barId={activeBar.id}
      />
    </PageTransition>
  );
}
