"use client";

import { useState, useTransition } from "react";
import type { Bottle } from "@/lib/types";
import { calculateBottleTotalLiters, calculateTotalBottlesCount, formatLiters } from "@/lib/volumeUtils";
import { updateBottleQuantity } from "@/app/actions";
import BottlePreview from "./BottlePreview";
import BottleDetailModal from "./BottleDetailModal";

export default function BottleGridCard({ bottle }: { bottle: Bottle }) {
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
        className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-300 cursor-pointer overflow-hidden ${
          bottle.vip
            ? "border-gold/30 bg-brick-dark/30 hover:border-gold/50 hover:bg-brick-dark/40"
            : isLow && totalBottles === 0
            ? "border-red-500/30 bg-red-950/20 hover:border-red-500/50"
            : "border-white/[0.08] bg-ink-2/70 hover:border-orange/40 hover:bg-ink-2"
        } box-orange-glow-hover`}
      >
        {/* Top visual shelf display */}
        <div className="relative w-full h-44 rounded-xl bg-ink/80 border border-white/[0.07] flex items-center justify-center overflow-hidden p-3 mb-3.5 shadow-inner group-hover:border-orange/20 transition-colors">
          {bottle.imageUrl ? (
            <img src={bottle.imageUrl} alt={bottle.name} className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-500" />
          ) : (
            <BottlePreview type={bottle.type} quantity={totalBottles} vip={bottle.vip} />
          )}

          {/* Top Left Badge: Category */}
          <span className="absolute top-2.5 left-2.5 text-[9px] font-bold uppercase tracking-caps px-2 py-1 rounded-md bg-ink-2/90 border border-white/[0.1] text-gold">
            {bottle.type}
          </span>

          {/* Top Right Badges */}
          <div className="absolute top-2.5 right-2.5 flex flex-col gap-1 items-end">
            {bottle.vip && (
              <span className="text-[9px] uppercase tracking-caps bg-gradient-to-r from-gold to-copper text-ink px-2 py-0.5 rounded font-bold shadow-md">
                VIP
              </span>
            )}
            {isLow && (
              <span
                className={`text-[9px] uppercase tracking-caps px-2 py-0.5 rounded font-bold ${
                  totalBottles === 0
                    ? "bg-red-600 text-white animate-pulse"
                    : "bg-red-500/20 text-red-400 border border-red-500/30"
                }`}
              >
                {totalBottles === 0 ? "Épuisé" : "Stock bas"}
              </span>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="space-y-1.5 flex-1 flex flex-col justify-between">
          <div>
            <h3 className="font-display text-lg font-bold text-cream group-hover:text-orange transition-colors line-clamp-1">
              {bottle.name}
            </h3>
            <p className="text-[11px] text-muted line-clamp-1">
              {bottle.volumes && bottle.volumes.length > 0
                ? bottle.volumes.map((v) => `${v.quantity}x ${v.size}`).join(" • ")
                : "Format Standard"}
            </p>
          </div>

          {/* Volume Price/Weight Market Tag */}
          <div className="flex items-baseline justify-between pt-2 border-t border-white/[0.06] mt-2">
            <span className="text-xs text-muted font-medium">Volume total :</span>
            <span className="font-display text-2xl font-bold text-orange tracking-tight">
              {formatLiters(totalLiters)}
            </span>
          </div>
        </div>

        {/* Bottom Grocery Cart Stepper */}
        <div
          onClick={(e) => e.stopPropagation()}
          className="mt-3.5 flex items-center justify-between bg-ink/90 border border-white/[0.1] rounded-xl p-1.5 shadow-inner"
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleQuickAdjust(-1);
            }}
            disabled={isPending || totalBottles === 0}
            className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-orange/20 hover:text-orange text-cream font-bold transition-colors flex items-center justify-center text-sm disabled:opacity-30 cursor-pointer"
            title="Retirer 1 bouteille"
          >
            −
          </button>
          <div className="text-center">
            <span className="font-mono text-xs font-bold text-cream block leading-none">
              {totalBottles} btl
            </span>
            <span className="text-[9px] text-muted uppercase tracking-wider">En rayon</span>
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleQuickAdjust(1);
            }}
            disabled={isPending}
            className="w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-orange/20 hover:text-orange text-cream font-bold transition-colors flex items-center justify-center text-sm cursor-pointer"
            title="Ajouter 1 bouteille"
          >
            +
          </button>
        </div>
      </div>

      {modalOpen && (
        <BottleDetailModal bottle={bottle} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
