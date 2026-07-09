"use client";

import { useState, useTransition } from "react";
import type { Bottle } from "@/lib/types";
import { calculateBottleTotalLiters, calculateTotalBottlesCount, formatLiters } from "@/lib/volumeUtils";
import { updateBottleQuantity } from "@/app/actions";
import BottlePreview from "./BottlePreview";
import BottleDetailModal from "./BottleDetailModal";

export default function BottleListRow({ bottle }: { bottle: Bottle }) {
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const totalLiters = calculateBottleTotalLiters(bottle);
  const totalBottles = calculateTotalBottlesCount(bottle);

  const isLow =
    bottle.lowStockThreshold != null && totalBottles <= bottle.lowStockThreshold;

  const handleQuickAdjust = (delta: number) => {
    startTransition(() => {
      updateBottleQuantity(bottle.id, delta);
    });
  };

  return (
    <>
      <div
        onClick={() => setModalOpen(true)}
        className={`group flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border transition-all duration-300 cursor-pointer ${
          bottle.vip
            ? "border-gold/30 bg-brick-dark/30 hover:border-gold/50 hover:bg-brick-dark/40"
            : isLow && totalBottles === 0
            ? "border-red-500/30 bg-red-950/20 hover:border-red-500/50"
            : "border-white/[0.07] bg-ink-2/60 hover:border-orange/35 hover:bg-ink-2"
        } box-orange-glow-hover`}
      >
        {/* Left: Fresh Grocery Shelf Product & Info */}
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-14 h-16 flex-shrink-0 bg-ink rounded-xl border border-white/[0.09] flex items-center justify-center overflow-hidden p-1.5 relative shadow-inner">
            {bottle.imageUrl ? (
              <img src={bottle.imageUrl} alt={bottle.name} className="w-full h-full object-contain" />
            ) : (
              <BottlePreview type={bottle.type} quantity={totalBottles} vip={bottle.vip} />
            )}
            {totalBottles === 0 && (
              <span className="absolute inset-0 bg-ink/90 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider text-red-400">
                Rupture
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h3 className="font-display text-lg sm:text-xl font-bold text-cream group-hover:text-orange transition-colors">
                {bottle.name}
              </h3>
              {bottle.vip && (
                <span className="text-[10px] uppercase tracking-caps bg-gradient-to-r from-gold to-copper text-ink px-2 py-0.5 rounded font-bold shadow-sm">
                  VIP
                </span>
              )}
              {isLow && (
                <span className={`text-[10px] uppercase tracking-caps px-2 py-0.5 rounded font-bold ${
                  totalBottles === 0 ? "bg-red-600 text-white animate-pulse" : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}>
                  {totalBottles === 0 ? "Épuisé" : "Stock bas"}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5 mt-1.5 flex-wrap">
              <span className="text-xs uppercase tracking-caps text-gold font-semibold">
                {bottle.type}
              </span>
              <span className="text-muted/40">•</span>
              <span className="inline-flex items-center gap-1 text-[11px] bg-white/[0.04] px-2 py-0.5 rounded border border-white/[0.06] text-muted">
                🧊 {bottle.volumes && bottle.volumes.length > 0
                  ? bottle.volumes.map((v) => `${v.quantity}x ${v.size}`).join(" + ")
                  : "Format Standard"}
              </span>
              {bottle.tags.length > 0 && (
                <span className="text-xs text-muted/70 truncate hidden md:inline">
                  · {bottle.tags.slice(0, 3).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: Fresh Grocery Stepper & Volume Badge */}
        <div className="flex items-center justify-between sm:justify-end gap-5 sm:gap-6 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.05] flex-shrink-0">
          {/* Grocery Inline Stepper */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-1 bg-ink/90 border border-white/[0.1] rounded-xl p-1 shadow-inner"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickAdjust(-1);
              }}
              disabled={isPending || totalBottles === 0}
              className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-orange/20 hover:text-orange text-cream font-bold transition-colors flex items-center justify-center text-sm disabled:opacity-30 cursor-pointer"
              title="Retirer 1 bouteille"
            >
              −
            </button>
            <span className="w-10 text-center font-mono text-xs font-bold text-cream">
              {totalBottles} btl
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleQuickAdjust(1);
              }}
              disabled={isPending}
              className="w-7 h-7 rounded-lg bg-white/[0.05] hover:bg-orange/20 hover:text-orange text-cream font-bold transition-colors flex items-center justify-center text-sm cursor-pointer"
              title="Ajouter 1 bouteille"
            >
              +
            </button>
          </div>

          {/* Total Liters Price/Market Badge */}
          <div className="text-right min-w-[85px]">
            <div className="font-display text-xl sm:text-2xl font-bold text-orange tracking-tight">
              {formatLiters(totalLiters)}
            </div>
            <div className="text-[11px] text-muted font-medium">
              en stock total
            </div>
          </div>

          {/* Details trigger button */}
          <div 
            className="w-9 h-9 rounded-xl bg-white/[0.04] border border-white/[0.08] group-hover:border-orange group-hover:bg-orange group-hover:text-ink text-muted flex items-center justify-center transition-all shrink-0"
            title="Ouvrir la fiche détaillée"
          >
            <span className="text-sm font-bold">→</span>
          </div>
        </div>
      </div>

      {modalOpen && (
        <BottleDetailModal bottle={bottle} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
