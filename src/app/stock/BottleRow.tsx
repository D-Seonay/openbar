"use client";

import { useState, useTransition } from "react";
import { updateBottleQuantity, updateBottleThreshold, deleteBottleAction } from "@/app/actions";
import type { Bottle } from "@/lib/types";
import BottlePreview from "./BottlePreview";

export default function BottleRow({ bottle }: { bottle: Bottle }) {
  const [quantity, setQuantity] = useState(bottle.quantity);
  const [threshold, setThreshold] = useState(
    bottle.lowStockThreshold != null ? String(bottle.lowStockThreshold) : ""
  );
  const [showConfig, setShowConfig] = useState(false);
  const [isPending, startTransition] = useTransition();

  const parsedThreshold = threshold.trim() === "" ? null : Number(threshold);
  const isLow = parsedThreshold !== null && !Number.isNaN(parsedThreshold) && quantity <= parsedThreshold;

  function change(delta: number) {
    const next = Math.max(0, Math.round((quantity + delta) * 10) / 10);
    setQuantity(next);
    startTransition(() => {
      updateBottleQuantity(bottle.id, next);
    });
  }

  function saveThreshold(raw: string) {
    setThreshold(raw);
    const trimmed = raw.trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    if (parsed !== null && Number.isNaN(parsed)) return;
    startTransition(() => {
      updateBottleThreshold(bottle.id, parsed);
    });
  }

  return (
    <div className={`relative group rounded-xl border p-4 transition-all duration-300 ${
      bottle.vip 
        ? "border-gold/20 bg-brick-dark/20 hover:border-gold/40" 
        : isLow && quantity === 0
        ? "border-red-500/25 bg-red-950/10 hover:border-red-500/40"
        : "border-orange/10 bg-ink-2/40 hover:border-orange/30"
    } box-orange-glow-hover`}>
      <div className="flex gap-4 items-start">
        {/* Visual bottle preview with level */}
        <div className="flex-shrink-0">
          <BottlePreview type={bottle.type} quantity={quantity} vip={bottle.vip} />
        </div>

        {/* Bottle Information */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-28 py-1">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display text-lg text-cream font-medium truncate max-w-[150px] sm:max-w-none" title={bottle.name}>
                {bottle.name}
              </h3>
              {bottle.vip && (
                <span className="text-[9px] uppercase tracking-wider bg-gold text-ink px-1.5 py-0.5 rounded font-bold">
                  VIP
                </span>
              )}
              {isLow && (
                <span className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded font-bold ${
                  quantity === 0 ? "bg-red-500 text-white animate-pulse" : "bg-red-500/20 text-red-400"
                }`}>
                  {quantity === 0 ? "Épuisé" : "Stock bas"}
                </span>
              )}
            </div>
            
            <p className="text-[10px] text-orange/80 uppercase tracking-widest mt-0.5 font-mono capitalize">
              {bottle.type}
            </p>

            {bottle.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {bottle.tags.map((t) => (
                  <span key={t} className="text-[10px] bg-ink/60 border border-orange/5 text-muted px-2 py-0.5 rounded-full">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Quick Quantity Changer */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-1.5 bg-ink/80 rounded-lg p-1 border border-orange/10">
              <button
                onClick={() => change(-0.5)}
                disabled={isPending}
                className="w-7 h-7 rounded-md bg-brick-light/20 hover:bg-orange hover:text-white transition-all disabled:opacity-30 text-xs font-bold"
                title="-0.5 bouteille"
              >
                −
              </button>
              <span className={`w-8 text-center font-mono text-xs font-semibold ${quantity === 0 ? "text-red-400" : "text-cream"}`}>
                {quantity}
              </span>
              <button
                onClick={() => change(0.5)}
                disabled={isPending}
                className="w-7 h-7 rounded-md bg-brick-light/20 hover:bg-orange hover:text-white transition-all disabled:opacity-30 text-xs font-bold"
                title="+0.5 bouteille"
              >
                +
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowConfig(!showConfig)}
                className={`text-xs p-1.5 rounded-md border transition-all ${
                  showConfig ? "border-orange text-orange" : "border-orange/10 text-muted hover:text-cream"
                }`}
                title="Configuration & détails"
              >
                ⚙️
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Expandable Configuration Details */}
      {showConfig && (
        <div className="mt-4 pt-4 border-t border-orange/10 space-y-3 bg-ink/30 p-3 rounded-lg text-xs animate-fadeIn">
          {bottle.notes && (
            <div>
              <p className="text-[10px] uppercase text-muted tracking-wider mb-1">Note de dégustation / Emplacement</p>
              <p className="text-cream italic">{bottle.notes}</p>
            </div>
          )}

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-muted">Seuil d&apos;alerte :</label>
              <input
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(e) => saveThreshold(e.target.value)}
                placeholder="Aucune"
                className="w-14 bg-ink border border-orange/20 rounded px-2 py-1 text-center text-cream focus:outline-none focus:border-orange"
              />
            </div>

            <button
              onClick={() => {
                if (confirm(`Supprimer ${bottle.name} ?`)) {
                  startTransition(() => deleteBottleAction(bottle.id));
                }
              }}
              className="text-red-400 hover:text-red-300 font-medium px-2 py-1 rounded hover:bg-red-950/20 transition-colors"
            >
              Supprimer la bouteille
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

