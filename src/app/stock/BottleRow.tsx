"use client";

import { useState, useTransition } from "react";
import { updateBottleQuantity, updateBottleThreshold, deleteBottleAction } from "@/app/actions";
import type { Bottle } from "@/lib/types";

export default function BottleRow({ bottle }: { bottle: Bottle }) {
  const [quantity, setQuantity] = useState(bottle.quantity);
  const [threshold, setThreshold] = useState(
    bottle.lowStockThreshold != null ? String(bottle.lowStockThreshold) : ""
  );
  const [isPending, startTransition] = useTransition();

  const isLow = bottle.lowStockThreshold != null && quantity <= bottle.lowStockThreshold;

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
    <tr className="border-b border-cream/10 last:border-0">
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-cream">{bottle.name}</span>
          {bottle.vip && (
            <span className="text-[10px] uppercase tracking-wide bg-gold text-ink px-1.5 py-0.5 rounded font-bold">
              VIP
            </span>
          )}
          {isLow && (
            <span className="text-[10px] uppercase tracking-wide bg-red-400/20 text-red-400 px-1.5 py-0.5 rounded font-bold">
              Stock bas
            </span>
          )}
        </div>
        {bottle.tags.length > 0 && (
          <div className="text-xs text-muted mt-0.5">{bottle.tags.join(", ")}</div>
        )}
        {bottle.notes && <div className="text-xs text-muted italic mt-0.5">{bottle.notes}</div>}
      </td>
      <td className="py-2 pr-3 text-muted capitalize">{bottle.type}</td>
      <td className="py-2 pr-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => change(-1)}
            disabled={isPending}
            className="w-6 h-6 rounded bg-brick-light/40 hover:bg-brick-light/70 text-sm disabled:opacity-50"
          >
            −
          </button>
          <span className={`w-8 text-center ${quantity === 0 ? "text-red-400" : "text-cream"}`}>{quantity}</span>
          <button
            onClick={() => change(1)}
            disabled={isPending}
            className="w-6 h-6 rounded bg-brick-light/40 hover:bg-brick-light/70 text-sm disabled:opacity-50"
          >
            +
          </button>
        </div>
      </td>
      <td className="py-2 pr-3">
        <input
          type="number"
          min="0"
          step="1"
          value={threshold}
          onChange={(e) => saveThreshold(e.target.value)}
          placeholder="—"
          title="Alerte si la quantité descend à ce niveau ou en dessous"
          className="w-16 bg-ink border border-brick-light/40 rounded px-2 py-1 text-xs text-center focus:outline-none focus:border-gold/60"
        />
      </td>
      <td className="py-2 text-right">
        <button
          onClick={() => startTransition(() => deleteBottleAction(bottle.id))}
          className="text-xs text-muted hover:text-red-400"
        >
          Supprimer
        </button>
      </td>
    </tr>
  );
}
