"use client";

import { useState, useTransition } from "react";
import { updateBottleQuantity, updateBottleThreshold, deleteBottleAction, updateBottleVolumes } from "@/app/actions";
import type { Bottle, BottleVolume } from "@/lib/types";
import BottleImage from "@/components/BottleImage";

export default function BottleRow({ bottle }: { bottle: Bottle }) {
  const [quantity, setQuantity] = useState(bottle.quantity);
  const [threshold, setThreshold] = useState(
    bottle.lowStockThreshold != null ? String(bottle.lowStockThreshold) : ""
  );
  const [showConfig, setShowConfig] = useState(false);
  const [volumes, setVolumes] = useState<BottleVolume[]>(bottle.volumes ?? []);
  const [newSize, setNewSize] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [isPending, startTransition] = useTransition();

  const parsedThreshold = threshold.trim() === "" ? null : Number(threshold);
  const isLow = parsedThreshold !== null && !Number.isNaN(parsedThreshold) && quantity <= parsedThreshold;

  function change(delta: number) {
    const next = Math.max(0, Math.round((quantity + delta) * 10) / 10);
    setQuantity(next);
    startTransition(() => {
      // If we have detailed volumes, adjust the first one or clear volumes if quantity reaches 0
      if (volumes.length > 0) {
        let updated = [...volumes];
        if (next === 0) {
          updated = updated.map(v => ({ ...v, quantity: 0 }));
        } else {
          // simple logic: add or subtract from first format
          updated[0].quantity = Math.max(0, updated[0].quantity + delta);
        }
        setVolumes(updated);
        updateBottleVolumes(bottle.id, updated, bottle.imageUrl);
      } else {
        updateBottleQuantity(bottle.id, next);
      }
    });
  }

  function changeVolumeQty(idx: number, delta: number) {
    const nextVols = [...volumes];
    nextVols[idx].quantity = Math.max(0, nextVols[idx].quantity + delta);
    const totalQty = nextVols.reduce((sum, v) => sum + v.quantity, 0);
    setVolumes(nextVols);
    setQuantity(totalQty);
    startTransition(() => {
      updateBottleVolumes(bottle.id, nextVols, bottle.imageUrl);
    });
  }

  function addFormat() {
    if (!newSize.trim()) return;
    const nextVols = [...volumes, { size: newSize.trim(), quantity: newQty }];
    const totalQty = nextVols.reduce((sum, v) => sum + v.quantity, 0);
    setVolumes(nextVols);
    setQuantity(totalQty);
    setNewSize("");
    setNewQty(1);
    startTransition(() => {
      updateBottleVolumes(bottle.id, nextVols, bottle.imageUrl);
    });
  }

  function removeFormat(idx: number) {
    const nextVols = volumes.filter((_, i) => i !== idx);
    const totalQty = nextVols.reduce((sum, v) => sum + v.quantity, 0);
    setVolumes(nextVols);
    setQuantity(totalQty);
    startTransition(() => {
      updateBottleVolumes(bottle.id, nextVols, bottle.imageUrl);
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

  // Format list description (e.g. 1.5L (x1) · 1L (x1))
  const volumesDesc = volumes.length > 0 
    ? volumes.filter(v => v.quantity > 0).map(v => `${v.size} (x${v.quantity})`).join(" · ")
    : null;

  return (
    <div className={`relative group rounded-xl border p-4 transition-all duration-300 flex flex-col justify-between ${
      bottle.vip 
        ? "border-gold/25 bg-brick-dark/15 hover:border-gold/45" 
        : isLow && quantity === 0
        ? "border-red-500/25 bg-red-950/10 hover:border-red-500/40"
        : "border-orange/15 bg-ink-2/30 hover:border-orange/35"
    } box-orange-glow-hover`}>
      <div className="flex gap-4 items-start">
        {/* Visual bottle preview or custom image */}
        <div className="flex-shrink-0 w-16 h-28 flex items-center justify-center bg-ink-2/65 rounded-lg border border-orange/5 overflow-hidden relative">
          {bottle.imageUrl ? (
            <img 
              src={bottle.imageUrl} 
              alt={bottle.name} 
              className="w-full h-full object-contain p-1 filter drop-shadow-[0_2px_5px_rgba(0,0,0,0.5)]" 
            />
          ) : (
            <BottlePreview type={bottle.type} quantity={quantity} vip={bottle.vip} />
          )}

          {/* Numerical Total Badge */}
          <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-mono font-bold ${
            quantity === 0
              ? "bg-red-600 text-white"
              : bottle.vip
              ? "bg-gold text-ink"
              : "bg-orange text-white"
          }`}>
            {quantity}
          </div>
        </div>

        {/* Bottle Information */}
        <div className="flex-1 min-w-0 flex flex-col justify-between h-28 py-1">
          <div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-display text-base text-cream font-medium truncate max-w-[130px] sm:max-w-none" title={bottle.name}>
                {bottle.name}
              </h3>
              {bottle.vip && (
                <span className="text-[8px] uppercase tracking-wide bg-gold text-ink px-1.5 py-0.5 rounded font-bold">
                  VIP
                </span>
              )}
              {isLow && (
                <span className={`text-[8px] uppercase tracking-wide px-1.5 py-0.5 rounded font-bold ${
                  quantity === 0 ? "bg-red-500 text-white animate-pulse" : "bg-red-500/20 text-red-400"
                }`}>
                  {quantity === 0 ? "Épuisé" : "Stock bas"}
                </span>
              )}
            </div>
            
            <p className="text-[9px] text-orange uppercase tracking-wider font-mono capitalize mt-0.5">
              {bottle.type}
            </p>

            {/* Volumes sizes detail (1.5L x 1, 1L x 1) */}
            {volumesDesc ? (
              <p className="text-[10px] text-orange-dim/95 font-medium mt-1 truncate">
                📦 {volumesDesc}
              </p>
            ) : bottle.notes ? (
              <p className="text-[10px] text-muted italic mt-1 truncate">
                {bottle.notes}
              </p>
            ) : null}
          </div>

          {/* Quick Total Quantity Changer */}
          <div className="flex items-center justify-between mt-2.5">
            <div className="flex items-center gap-1 bg-ink/90 rounded-lg p-0.5 border border-orange/10">
              <button
                onClick={() => change(-1)}
                disabled={isPending}
                className="w-6.5 h-6.5 rounded bg-brick-light/10 hover:bg-orange hover:text-white transition-all disabled:opacity-30 text-xs font-bold"
                title="-1 bouteille"
              >
                −
              </button>
              <span className={`w-7 text-center font-mono text-xs font-semibold ${quantity === 0 ? "text-red-400" : "text-cream"}`}>
                {quantity}
              </span>
              <button
                onClick={() => change(1)}
                disabled={isPending}
                className="w-6.5 h-6.5 rounded bg-brick-light/10 hover:bg-orange hover:text-white transition-all disabled:opacity-30 text-xs font-bold"
                title="+1 bouteille"
              >
                +
              </button>
            </div>

            <button
              onClick={() => setShowConfig(!showConfig)}
              className={`text-xs p-1 rounded-lg border transition-all ${
                showConfig ? "border-orange text-orange" : "border-orange/10 text-muted hover:text-cream"
              }`}
              title="Configuration détaillée"
            >
              ⚙️
            </button>
          </div>
        </div>
      </div>

      {/* Expandable Configuration Details / Volumes Editor */}
      {showConfig && (
        <div className="mt-4 pt-4 border-t border-orange/10 space-y-3 bg-ink/40 p-3 rounded-xl text-xs animate-fadeIn">
          {bottle.notes && (
            <div>
              <p className="text-[9px] uppercase text-muted tracking-wider mb-0.5">Notes</p>
              <p className="text-cream italic">{bottle.notes}</p>
            </div>
          )}

          {/* Detailed volume manager */}
          <div className="space-y-1.5">
            <p className="text-[9px] uppercase text-orange tracking-wider font-semibold">Détails des Formats</p>
            {volumes.length === 0 ? (
              <p className="text-[10px] text-muted italic">Format de bouteille non spécifié.</p>
            ) : (
              <div className="space-y-1.5">
                {volumes.map((vol, idx) => (
                  <div key={idx} className="flex justify-between items-center bg-ink-2/30 px-2 py-1 rounded">
                    <span className="font-mono text-cream">{vol.size}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => changeVolumeQty(idx, -1)}
                        disabled={isPending}
                        className="w-5 h-5 rounded bg-brick-light/10 hover:bg-orange text-white flex items-center justify-center font-bold text-xs"
                      >
                        −
                      </button>
                      <span className="w-5 text-center font-mono text-cream font-bold">{vol.quantity}</span>
                      <button
                        onClick={() => changeVolumeQty(idx, 1)}
                        disabled={isPending}
                        className="w-5 h-5 rounded bg-brick-light/10 hover:bg-orange text-white flex items-center justify-center font-bold text-xs"
                      >
                        +
                      </button>
                      <button
                        onClick={() => removeFormat(idx)}
                        disabled={isPending}
                        className="text-muted hover:text-red-400 ml-1.5 font-bold"
                        title="Retirer ce format"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Quick add new format */}
            <div className="flex gap-1.5 mt-2">
              <input
                type="text"
                placeholder="Taille (ex: 1.5L)"
                value={newSize}
                onChange={(e) => setNewSize(e.target.value)}
                className="bg-ink border border-orange/15 rounded-lg px-2 py-1 text-[11px] flex-1 text-cream placeholder:text-muted/40 focus:outline-none"
              />
              <button
                onClick={addFormat}
                className="bg-orange/20 text-orange border border-orange-dark/30 rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wider hover:bg-orange hover:text-white transition-all"
              >
                Ajouter
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 pt-2 border-t border-orange/5">
            <div className="flex items-center gap-1.5">
              <label className="text-muted text-[10px]">Alerte :</label>
              <input
                type="number"
                min="0"
                step="1"
                value={threshold}
                onChange={(e) => saveThreshold(e.target.value)}
                placeholder="Aucune"
                className="w-12 bg-ink border border-orange/15 rounded px-1.5 py-0.5 text-center text-cream focus:outline-none"
              />
            </div>

            <button
              onClick={() => {
                if (confirm(`Supprimer ${bottle.name} du stock ?`)) {
                  startTransition(() => deleteBottleAction(bottle.id));
                }
              }}
              className="text-red-400 hover:text-red-300 font-medium px-2 py-0.5 rounded hover:bg-red-950/20 transition-colors text-[10px]"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

