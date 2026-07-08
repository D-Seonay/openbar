import { listBottles } from "@/lib/db";
import { createBottle } from "@/app/actions";
import BottleTable from "./BottleTable";

const TYPES = [
  ["whisky", "Whisky"],
  ["rhum", "Rhum"],
  ["vodka", "Vodka"],
  ["gin", "Gin"],
  ["tequila", "Tequila"],
  ["liqueur", "Liqueur / apéritif"],
  ["vin", "Vin"],
  ["champagne", "Champagne / bulles"],
  ["biere", "Bière"],
  ["mixer", "Soft / mixer (tonic, jus, sirop...)"],
  ["autre", "Autre"],
] as const;

export default async function StockPage() {
  const bottles = await listBottles();
  const normal = bottles.filter((b) => !b.vip);
  const vip = bottles.filter((b) => b.vip);

  return (
    <div className="space-y-10">
      <div>
        <p className="text-xs uppercase tracking-caps text-gold-dim mb-2">Inventaire</p>
        <h1 className="font-display text-4xl text-gold">Stock</h1>
        <p className="text-muted text-sm mt-2 max-w-lg">
          Note tout ce qu&apos;il y a chez toi : alcools et mixers (jus, sodas, sirops...) pour que les
          cocktails se calculent tout seuls.
        </p>
      </div>

      <section className="rounded-xl border border-cream/10 bg-ink-2 p-6">
        <h2 className="font-display text-xl text-cream mb-4">Ajouter une bouteille</h2>
        <form action={createBottle} className="grid sm:grid-cols-2 gap-3">
          <input
            name="name"
            placeholder="Nom (ex: Havana 7 ans)"
            required
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm sm:col-span-2 placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
          <select
            name="type"
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-gold/60"
          >
            {TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            name="quantity"
            type="number"
            step="0.5"
            min="0"
            defaultValue={1}
            placeholder="Quantité"
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
          <input
            name="tags"
            placeholder="Tags cocktail, séparés par des virgules (ex: rhum blanc, citron vert)"
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm sm:col-span-2 placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
          <input
            name="notes"
            placeholder="Note (optionnel)"
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm sm:col-span-2 placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
          <input
            name="lowStockThreshold"
            type="number"
            min="0"
            step="1"
            placeholder="Seuil d'alerte (optionnel, ex: 1)"
            className="bg-ink border border-brick-light/60 rounded-lg px-3 py-2 text-sm placeholder:text-muted/60 focus:outline-none focus:border-gold/60"
          />
          <label className="flex items-center gap-2 text-sm text-gold">
            <input type="checkbox" name="vip" className="accent-gold" />
            Réserver à la section VIP
          </label>
          <button
            type="submit"
            className="sm:col-span-2 bg-gold text-ink font-medium rounded-lg py-2 hover:bg-cream transition-colors"
          >
            Ajouter au stock
          </button>
        </form>
      </section>

      <BottleTable title="Stock courant" bottles={normal} empty="Rien pour l'instant, ajoute ta première bouteille." />

      <section className="rounded-xl border border-gold/25 bg-brick-dark/40 p-6">
        <h2 className="font-display text-xl text-gold mb-1">Réserve VIP</h2>
        <p className="text-xs text-muted mb-4">
          Visible uniquement par les invités identifiés comme VIP sur la page de la soirée.
        </p>
        <BottleTable bottles={vip} empty="Pas encore de bouteille VIP." bare />
      </section>
    </div>
  );
}
