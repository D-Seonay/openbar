"use client";

import { useState, useMemo, useTransition } from "react";
import type { Bottle } from "@/lib/types";
import { submitBilan } from "@/app/actions";
import { calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";

const GROCERY_AISLES = [
  { id: "", label: "🛒 Tous les rayons" },
  { id: "whisky", label: "🥃 Whiskies" },
  { id: "rhum", label: "🏴‍☠️ Rhums" },
  { id: "gin", label: "🍸 Gins" },
  { id: "vodka", label: "❄️ Vodkas" },
  { id: "tequila", label: "🌵 Tequilas" },
  { id: "liqueur", label: "✨ Liqueurs" },
  { id: "vin", label: "🍷 Vins" },
  { id: "champagne", label: "🍾 Champagnes" },
  { id: "biere", label: "🍺 Bières" },
  { id: "mixer", label: "🍋 Softs" },
  { id: "autre", label: "📦 Autres" },
] as const;

interface EnrichedBottle extends Bottle {
  originalQuantity?: number;
}

interface BilanClientFormProps {
  slug: string;
  bottles: EnrichedBottle[];
}

export default function BilanClientForm({ slug, bottles }: BilanClientFormProps) {
  const [query, setQuery] = useState("");
  const [selectedAisle, setSelectedAisle] = useState("");
  const [onlyModified, setOnlyModified] = useState(false);

  // Map of bottleId -> current after quantity
  const [quantities, setQuantities] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    for (const b of bottles) {
      initial[b.id] = b.quantity;
    }
    return initial;
  });

  const [isPending, startTransition] = useTransition();

  const handleAdjust = (bottleId: string, delta: number) => {
    setQuantities((prev) => {
      const current = prev[bottleId] ?? 0;
      const next = Math.max(0, Number((current + delta).toFixed(1)));
      return { ...prev, [bottleId]: next };
    });
  };

  const handleSetExact = (bottleId: string, val: number) => {
    setQuantities((prev) => ({
      ...prev,
      [bottleId]: Math.max(0, Number(val.toFixed(1))),
    }));
  };

  const modifiedBottlesCount = useMemo(() => {
    let count = 0;
    for (const b of bottles) {
      const original = b.originalQuantity ?? b.quantity;
      if ((quantities[b.id] ?? b.quantity) !== original) {
        count++;
      }
    }
    return count;
  }, [bottles, quantities]);

  const totalConsumedBottles = useMemo(() => {
    let consumed = 0;
    for (const b of bottles) {
      const original = b.originalQuantity ?? b.quantity;
      const after = quantities[b.id] ?? b.quantity;
      if (after < original) {
        consumed += original - after;
      }
    }
    return Number(consumed.toFixed(1));
  }, [bottles, quantities]);

  const filteredBottles = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bottles.filter((b) => {
      const matchesQuery =
        !q || b.name.toLowerCase().includes(q) || b.tags.some((t) => t.includes(q));
      const matchesAisle = !selectedAisle || b.type === selectedAisle;
      const original = b.originalQuantity ?? b.quantity;
      const matchesModified =
        !onlyModified || (quantities[b.id] ?? b.quantity) !== original;
      return matchesQuery && matchesAisle && matchesModified;
    });
  }, [bottles, query, selectedAisle, onlyModified, quantities]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData();
    for (const b of bottles) {
      const q = quantities[b.id] ?? b.quantity;
      formData.set(`quantity-${b.id}`, String(q));
    }

    startTransition(() => {
      submitBilan(slug, formData);
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Search & Aisles Controls */}
      <div className="space-y-4 bg-ink-2/80 border border-white/[0.08] p-4 sm:p-5 rounded-2xl shadow-xl">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-muted text-sm pointer-events-none">
              🔍
            </span>
            <input
              type="text"
              placeholder="Rechercher une bouteille (Ricard, Gin, Coca...)"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full bg-ink border border-white/[0.1] rounded-xl pl-10 pr-4 py-2.5 text-xs text-cream placeholder:text-muted/60 focus:outline-none focus:border-orange transition-colors"
            />
          </div>

          <label className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl bg-ink border border-white/[0.08] cursor-pointer hover:border-orange/40 transition-colors">
            <input
              type="checkbox"
              checked={onlyModified}
              onChange={(e) => setOnlyModified(e.target.checked)}
              className="rounded accent-orange"
            />
            <span className="text-xs font-semibold text-cream select-none">
              Modifiés uniquement ({modifiedBottlesCount})
            </span>
          </label>
        </div>

        {/* Rayon Horizontal Filter — swipeable rail, bleeds to the card edge. */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 -mx-4 px-4 sm:-mx-5 sm:px-5 no-scrollbar">
          {GROCERY_AISLES.map((aisle) => {
            const active = selectedAisle === aisle.id;
            return (
              <button
                key={aisle.id}
                type="button"
                onClick={() => setSelectedAisle(aisle.id)}
                className={`tap-target-sm flex items-center px-3 py-1.5 rounded-xl text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                  active
                    ? "bg-orange text-ink shadow-sm shadow-orange/30"
                    : "bg-white/[0.04] text-muted hover:text-cream hover:bg-white/[0.08]"
                }`}
              >
                {aisle.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottles List */}
      <div className="rounded-2xl border border-white/[0.08] bg-ink-2/60 divide-y divide-white/[0.06] shadow-xl">
        {filteredBottles.length === 0 ? (
          <div className="py-12 text-center text-muted text-xs">
            Aucune bouteille ne correspond à votre filtre.
          </div>
        ) : (
          filteredBottles.map((b) => {
            const original = b.originalQuantity ?? b.quantity;
            const currentQty = quantities[b.id] ?? b.quantity;
            const diff = currentQty - original;
            const totalLiters = calculateBottleTotalLiters(b);

            return (
              <div
                key={b.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-white/[0.02] transition-colors"
              >
                {/* Left: Bottle details & before stock */}
                <div className="flex items-start gap-3.5">
                  <div className="w-10 h-10 rounded-xl bg-white/[0.04] border border-white/[0.08] flex items-center justify-center text-xl shrink-0">
                    🍾
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-cream font-bold text-sm">{b.name}</span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-md bg-white/[0.06] text-muted">
                        {b.type}
                      </span>
                      {diff < 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-500/15 text-red-400 border border-red-500/30">
                          🔥 {diff} btl consommée(s)
                        </span>
                      )}
                      {diff > 0 && (
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          ➕ +{diff} btl
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted mt-1">
                      Stock initial :{" "}
                      <strong className="text-cream font-mono">{original} btl</strong> •{" "}
                      {formatLiters(totalLiters)}
                    </p>
                  </div>
                </div>

                {/* Right: Interactive Stepper & Shortcuts */}
                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-white/[0.05] shrink-0">
                  <button
                    type="button"
                    onClick={() => handleAdjust(b.id, -1)}
                    disabled={currentQty <= 0}
                    className="tap-target-sm flex items-center px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/30 text-red-400 text-xs font-bold transition-colors cursor-pointer disabled:opacity-30"
                    title="-1 bouteille consommée"
                  >
                    −1 consommée
                  </button>

                  <div className="flex items-center gap-1 bg-ink border border-white/[0.1] rounded-xl p-1">
                    <button
                      type="button"
                      onClick={() => handleAdjust(b.id, -0.5)}
                      disabled={currentQty <= 0}
                      aria-label="Retirer une demi-bouteille"
                      className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg bg-white/[0.05] hover:bg-orange/20 hover:text-orange text-cream font-bold text-xs flex items-center justify-center cursor-pointer disabled:opacity-30"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      inputMode="decimal"
                      value={currentQty}
                      onChange={(e) => handleSetExact(b.id, Number(e.target.value))}
                      className="w-16 sm:w-14 bg-transparent text-center font-mono text-sm sm:text-xs font-bold text-cream focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAdjust(b.id, 0.5)}
                      aria-label="Ajouter une demi-bouteille"
                      className="w-9 h-9 sm:w-7 sm:h-7 rounded-lg bg-white/[0.05] hover:bg-orange/20 hover:text-orange text-cream font-bold text-xs flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {diff !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetExact(b.id, original)}
                      className="tap-target-sm flex items-center text-[11px] text-muted hover:text-cream px-2 py-1 rounded-lg hover:bg-white/[0.05] transition-colors"
                      title="Annuler la modification pour cette bouteille"
                    >
                      Réinitialiser
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-safe z-40 bg-ink/95 backdrop-blur-xl border border-orange/40 rounded-2xl p-4 sm:p-5 shadow-2xl box-orange-glow flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="min-w-0">
            <span className="text-[10px] uppercase font-bold text-muted block">
              Bouteilles modifiées
            </span>
            <span className="font-display text-base sm:text-xl font-bold text-cream">
              {modifiedBottlesCount} référence{modifiedBottlesCount > 1 ? "s" : ""}
            </span>
          </div>
          <div className="border-l border-white/[0.1] pl-4 sm:pl-6 min-w-0">
            <span className="text-[10px] uppercase font-bold text-muted block">
              Consommation nette
            </span>
            <span className="font-display text-base sm:text-xl font-bold text-orange">
              {totalConsumedBottles} btl consommée{totalConsumedBottles > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="tap-target w-full sm:w-auto flex items-center justify-center px-6 py-3 rounded-xl bg-gradient-to-r from-orange to-gold text-ink font-bold text-xs uppercase tracking-wider shadow-lg shadow-orange/30 hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
        >
          {isPending
            ? "Enregistrement en cours..."
            : "✨ Valider et enregistrer le Bilan"}
        </button>
      </div>
    </form>
  );
}
