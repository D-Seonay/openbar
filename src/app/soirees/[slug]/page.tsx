import { notFound } from "next/navigation";
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
      <div>
        <p className="text-xs uppercase tracking-caps text-gold-dim mb-2">Soirée</p>
        <h1 className="font-display text-4xl text-gold">{event.name}</h1>
        <p className="text-muted text-sm mt-2 capitalize">
          {new Date(event.date).toLocaleDateString("fr-FR", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
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
