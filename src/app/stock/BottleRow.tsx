"use client";

import { useState, useTransition } from "react";
import { updateBottleQuantity, deleteBottleAction } from "@/app/actions";
import type { Bottle } from "@/lib/types";

export default function BottleRow({ bottle }: { bottle: Bottle }) {
  const [quantity, setQuantity] = useState(bottle.quantity);
  const [isPending, startTransition] = useTransition();

  function change(delta: number) {
    const next = Math.max(0, Math.round((quantity + delta) * 10) / 10);
    setQuantity(next);
    startTransition(() => {
      updateBottleQuantity(bottle.id, next);
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
