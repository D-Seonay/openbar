"use client";

import { useState, useMemo, useTransition } from "react";
import type { Bottle } from "@/lib/types";
import { submitBilan } from "@/app/actions";
import { calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";
import { Badge, Button, Card, EmptyState, Field, champClasses } from "@/components/ui";

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
      <Card className="space-y-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <Field label="Rechercher une bouteille" htmlFor="bilan-search">
              <div className="relative">
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 pl-3 flex items-center text-ink-soft pointer-events-none"
                >
                  🔍
                </span>
                <input
                  id="bilan-search"
                  type="text"
                  placeholder="Ricard, Gin, Coca..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className={`pl-9 ${champClasses}`}
                />
              </div>
            </Field>
          </div>

          <label
            htmlFor="bilan-only-modified"
            className="tap-target flex items-center gap-2.5 px-3.5 rounded-lg bg-paper-sunk border border-rule cursor-pointer hover:border-terracotta/40 transition-colors shrink-0"
          >
            <input
              id="bilan-only-modified"
              type="checkbox"
              checked={onlyModified}
              onChange={(e) => setOnlyModified(e.target.checked)}
              className="w-[18px] h-[18px] accent-terracotta"
            />
            <span className="text-[13px] font-semibold text-ink select-none">
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
                className={`tap-target flex items-center px-3 rounded-lg text-[13px] font-semibold transition-colors shrink-0 cursor-pointer ${
                  active
                    ? "bg-terracotta text-paper"
                    : "bg-paper-sunk border border-rule text-ink-soft hover:text-ink"
                }`}
              >
                {aisle.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* Bottles List */}
      <Card className="p-0 divide-y divide-rule overflow-hidden">
        {filteredBottles.length === 0 ? (
          <EmptyState
            titre="Aucune bouteille"
            message="Aucune bouteille ne correspond à votre filtre."
          />
        ) : (
          filteredBottles.map((b) => {
            const original = b.originalQuantity ?? b.quantity;
            const currentQty = quantities[b.id] ?? b.quantity;
            const diff = currentQty - original;
            const totalLiters = calculateBottleTotalLiters(b);
            const inputId = `bilan-qty-${b.id}`;

            return (
              <div
                key={b.id}
                className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                {/* Left: Bottle details & before stock */}
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-paper-sunk border border-rule flex items-center justify-center text-xl shrink-0">
                    🍾
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-ink font-bold text-[15px]">{b.name}</span>
                      <span className="text-[13px] uppercase font-semibold px-2 py-0.5 rounded-md bg-paper-sunk text-ink-soft border border-rule">
                        {b.type}
                      </span>
                      {diff < 0 && <Badge ton="alerte">🔥 {diff} btl consommée(s)</Badge>}
                      {diff > 0 && <Badge ton="complet">➕ +{diff} btl</Badge>}
                    </div>
                    <p className="text-[13px] text-ink-soft mt-1">
                      Stock initial :{" "}
                      <strong className="text-ink font-mono">{original} btl</strong> •{" "}
                      {formatLiters(totalLiters)}
                    </p>
                  </div>
                </div>

                {/* Right: Interactive Stepper & Shortcuts */}
                <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2 sm:gap-3 pt-3 sm:pt-0 border-t sm:border-t-0 border-rule shrink-0">
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => handleAdjust(b.id, -1)}
                    disabled={currentQty <= 0}
                    className="px-3 text-[13px]"
                    title="-1 bouteille consommée"
                  >
                    −1 consommée
                  </Button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleAdjust(b.id, -0.5)}
                      disabled={currentQty <= 0}
                      aria-label="Retirer une demi-bouteille"
                      className="tap-target px-3 rounded-lg border border-rule bg-paper hover:bg-paper-sunk hover:text-terracotta text-ink font-bold text-[15px] flex items-center justify-center disabled:opacity-30"
                    >
                      −
                    </button>
                    <div>
                      <label htmlFor={inputId} className="sr-only">
                        Quantité restante pour {b.name}
                      </label>
                      <input
                        id={inputId}
                        type="number"
                        min="0"
                        step="0.5"
                        inputMode="decimal"
                        value={currentQty}
                        onChange={(e) => handleSetExact(b.id, Number(e.target.value))}
                        className={`w-20 text-center font-mono font-bold ${champClasses}`}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleAdjust(b.id, 0.5)}
                      aria-label="Ajouter une demi-bouteille"
                      className="tap-target px-3 rounded-lg border border-rule bg-paper hover:bg-paper-sunk hover:text-terracotta text-ink font-bold text-[15px] flex items-center justify-center"
                    >
                      +
                    </button>
                  </div>

                  {diff !== 0 && (
                    <button
                      type="button"
                      onClick={() => handleSetExact(b.id, original)}
                      className="tap-target flex items-center text-[13px] text-ink-soft hover:text-ink px-2 rounded-lg hover:bg-paper-sunk transition-colors"
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
      </Card>

      {/* Sticky Bottom Bar */}
      <div className="sticky bottom-safe z-40 bg-paper border border-terracotta/40 rounded-xl p-4 sm:p-5 shadow-lg flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 sm:gap-6">
          <div className="min-w-0">
            <span className="text-[13px] uppercase font-bold text-ink-soft block">
              Bouteilles modifiées
            </span>
            <span className="font-display text-[17px] sm:text-[21px] font-bold text-ink">
              {modifiedBottlesCount} référence{modifiedBottlesCount > 1 ? "s" : ""}
            </span>
          </div>
          <div className="border-l border-rule pl-4 sm:pl-6 min-w-0">
            <span className="text-[13px] uppercase font-bold text-ink-soft block">
              Consommation nette
            </span>
            <span className="font-display text-[17px] sm:text-[21px] font-bold text-terracotta">
              {totalConsumedBottles} btl consommée{totalConsumedBottles > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <Button type="submit" disabled={isPending} pleineLargeur className="sm:w-auto">
          {isPending
            ? "Enregistrement en cours..."
            : "✨ Valider et enregistrer le Bilan"}
        </Button>
      </div>
    </form>
  );
}
