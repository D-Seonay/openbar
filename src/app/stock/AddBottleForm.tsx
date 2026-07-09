"use client";

import { useState } from "react";
import { createBottle } from "@/app/actions";
import type { BottleVolume } from "@/lib/types";
import ImagePicker from "@/components/ImagePicker";

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

export default function AddBottleForm() {
  const [volumes, setVolumes] = useState<BottleVolume[]>([{ size: "70cl", quantity: 1 }]);
  const [imageUrl, setImageUrl] = useState("");

  const addVolumeRow = () => {
    setVolumes([...volumes, { size: "1L", quantity: 1 }]);
  };

  const removeVolumeRow = (idx: number) => {
    setVolumes(volumes.filter((_, i) => i !== idx));
  };

  const updateVolume = (idx: number, field: keyof BottleVolume, value: string | number) => {
    const next = [...volumes];
    if (field === "quantity") {
      next[idx].quantity = Math.max(0, Number(value) || 0);
    } else {
      next[idx].size = String(value);
    }
    setVolumes(next);
  };

  return (
    <form action={createBottle} className="grid sm:grid-cols-2 gap-4">
      {/* Hidden input to pass volumes list as JSON */}
      <input type="hidden" name="volumes" value={JSON.stringify(volumes)} />

      <div className="sm:col-span-2">
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Nom de la bouteille</label>
        <input
          name="name"
          placeholder="Ex: Gin Hendrick's"
          required
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Type d&apos;ingrédient</label>
        <select
          name="type"
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        >
          {TYPES.map(([value, label]) => (
            <option key={value} value={value} className="bg-ink">
              {label}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <input type="hidden" name="imageUrl" value={imageUrl} />
        <ImagePicker value={imageUrl} onChange={setImageUrl} label="Photo du produit (Fichier local ou URL)" />
      </div>

      {/* Volumes and quantities editor */}
      <div className="sm:col-span-2 space-y-3 border border-orange/15 bg-ink/40 p-4 rounded-xl">
        <div className="flex justify-between items-center border-b border-orange/5 pb-2">
          <label className="text-xs uppercase tracking-caps text-gold-dim block">Formats en stock</label>
          <button
            type="button"
            onClick={addVolumeRow}
            className="text-[10px] uppercase tracking-caps text-orange hover:text-orange-hover font-semibold transition-colors"
          >
            ＋ Ajouter un format
          </button>
        </div>

        {volumes.length === 0 ? (
          <p className="text-xs text-muted/65 py-2">Aucun format configuré. La quantité générale sera de 0.</p>
        ) : (
          <div className="space-y-2">
            {volumes.map((vol, idx) => (
              <div key={idx} className="flex gap-3 items-center">
                <input
                  type="text"
                  placeholder="Ex: 70cl, 1L, 1.5L"
                  value={vol.size}
                  required
                  onChange={(e) => updateVolume(idx, "size", e.target.value)}
                  className="flex-1 bg-ink border border-orange/15 rounded-lg px-3 py-1.5 text-xs text-cream focus:outline-none focus:border-orange"
                />
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted font-mono">Qté:</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={vol.quantity}
                    required
                    onChange={(e) => updateVolume(idx, "quantity", e.target.value)}
                    className="w-16 bg-ink border border-orange/15 rounded-lg px-3 py-1.5 text-xs text-center text-cream focus:outline-none focus:border-orange"
                  />
                </div>
                {volumes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeVolumeRow(idx)}
                    className="text-xs text-muted hover:text-red-400 font-semibold px-2 py-1 transition-colors"
                  >
                    Retirer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="sm:col-span-2">
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Tags cocktail (séparés par virgules)</label>
        <input
          name="tags"
          placeholder="Ex: gin, citron vert, tonic"
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div className="sm:col-span-2">
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Notes / Emplacement (Optionnel)</label>
        <input
          name="notes"
          placeholder="Ex: étagère du milieu, bar principal"
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">Seuil d&apos;alerte (Optionnel)</label>
        <input
          name="lowStockThreshold"
          type="number"
          min="0"
          step="1"
          placeholder="Alerte si bouteilles <= X"
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div className="flex items-end pb-2">
        <label className="flex items-center gap-2.5 text-sm text-gold cursor-pointer select-none">
          <input 
            type="checkbox" 
            name="vip" 
            className="w-5 h-5 rounded border-orange/30 text-orange focus:ring-orange bg-ink accent-gold cursor-pointer" 
          />
          <span className="font-medium">Réserver à la section VIP</span>
        </label>
      </div>

      <button
        type="submit"
        className="sm:col-span-2 bg-orange text-ink font-semibold rounded-lg py-2.5 hover:bg-cream transition-colors mt-2 uppercase tracking-caps text-xs duration-350 cursor-pointer"
      >
        Ajouter au stock
      </button>
    </form>
  );
}
