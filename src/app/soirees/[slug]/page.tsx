import { notFound } from "next/navigation";
import Link from "next/link";
import { getEvent, listContributions, listBottles } from "@/lib/db";
import { evaluateRecipes } from "@/lib/cocktails";
import GuestPanel from "./GuestPanel";

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await getEvent(slug);
  if (!event) notFound();

  const [contributions, bottles] = await Promise.all([listContributions(slug), listBottles()]);

  const stock = bottles
    .filter((b) => !b.vip && b.type !== "mixer" && b.quantity > 0)
    .map((b) => ({ name: b.name, type: b.type, quantity: b.quantity }));

  const vipStock = bottles
    .filter((b) => b.vip && b.quantity > 0)
    .map((b) => ({ name: b.name, type: b.type, quantity: b.quantity }));

  const availability = evaluateRecipes(bottles);
  const readyCocktails = availability.filter((a) => a.makeable && !a.usesVip);
  const vipCocktails = availability.filter((a) => a.makeable && a.usesVip);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-orange/15 pb-4">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">Soirée en cours</span>
          <h1 className="font-display text-4xl text-cream mt-1">{event.name}</h1>
          <p className="text-muted text-xs mt-2 capitalize font-mono text-orange-dim">
            {new Date(event.date).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </p>
        </div>
        <Link
          href={`/soirees/${slug}/bilan`}
          className="shrink-0 text-xs px-4 py-2.5 rounded-xl border border-orange/20 text-orange hover:bg-orange hover:text-white transition-all duration-300 font-semibold uppercase tracking-wider text-center"
        >
          📝 Faire le bilan du stock
        </Link>
      </div>

      <GuestPanel
        slug={slug}
        vipNames={event.vipNames}
        contributions={contributions}
        stock={stock}
        vipStock={vipStock}
        readyCocktails={readyCocktails}
        vipCocktails={vipCocktails}
      />
    </div>
  );
}
