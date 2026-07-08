import { listBottles } from "@/lib/db";
import { createBottle } from "@/app/actions";
import StockTabs from "./StockTabs";

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

  const addBottleForm = (
    <form action={createBottle} className="grid sm:grid-cols-2 gap-4">
      <div className="sm:col-span-2">
        <label className="text-xs uppercase text-muted tracking-wider mb-1 block">Nom de la bouteille</label>
        <input
          name="name"
          placeholder="Ex: Havana Club 7 ans"
          required
          className="w-full bg-ink border border-orange/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div>
        <label className="text-xs uppercase text-muted tracking-wider mb-1 block">Type d&apos;ingrédient</label>
        <select
          name="type"
          className="w-full bg-ink border border-orange/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        >
          {TYPES.map(([value, label]) => (
            <option key={value} value={value} className="bg-ink">
              {label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs uppercase text-muted tracking-wider mb-1 block">Quantité de départ</label>
        <input
          name="quantity"
          type="number"
          step="0.5"
          min="0"
          defaultValue={1}
          placeholder="Quantité"
          className="w-full bg-ink border border-orange/10 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="text-xs uppercase text-muted tracking-wider mb-1 block">Tags pour cocktails (séparés par virgules)</label>
        <input
          name="tags"
          placeholder="Ex: rhum brun, citron vert, menthe"
          className="w-full bg-ink border border-orange/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="text-xs uppercase text-muted tracking-wider mb-1 block">Notes / Commentaires</label>
        <input
          name="notes"
          placeholder="Ex: étagère du haut, bouteille offerte par Noa"
          className="w-full bg-ink border border-orange/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div>
        <label className="text-xs uppercase text-muted tracking-wider mb-1 block">Seuil d&apos;alerte (Optionnel)</label>
        <input
          name="lowStockThreshold"
          type="number"
          min="0"
          step="1"
          placeholder="Ex: 1"
          className="w-full bg-ink border border-orange/10 rounded-xl px-4 py-2.5 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2.5 text-sm text-gold cursor-pointer select-none">
          <input 
            type="checkbox" 
            name="vip" 
            className="w-5 h-5 rounded border-orange/30 text-orange focus:ring-orange bg-ink accent-gold cursor-pointer" 
          />
          <span>Réserver à la section VIP</span>
        </label>
      </div>

      <button
        type="submit"
        className="sm:col-span-2 bg-orange text-white font-medium rounded-xl py-3 hover:bg-orange-hover box-orange-glow transition-all duration-300 mt-2 uppercase tracking-widest text-xs"
      >
        Ajouter au stock
      </button>
    </form>
  );

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-start">
        <div>
          <span className="text-[10px] uppercase tracking-[0.2em] text-orange font-semibold">Inventaire & Réserves</span>
          <h1 className="font-display text-4xl text-cream mt-1">Le Stock</h1>
          <p className="text-muted text-xs mt-2 max-w-lg leading-relaxed">
            Gérez vos bouteilles d&apos;alcool, softs et mixers. Les cocktails disponibles se mettent à jour automatiquement selon vos réserves.
          </p>
        </div>
      </div>

      <StockTabs normalBottles={normal} vipBottles={vip} addBottleForm={addBottleForm} />
    </div>
  );
}

