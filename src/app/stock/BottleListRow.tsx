"use client";

import type { Bottle } from "@/lib/types";
import { calculateBottleTotalLiters, formatLiters } from "@/lib/volumeUtils";
import { Row, Badge } from "@/components/ui";

interface BottleListRowProps {
  bottle: Bottle;
  isAdmin: boolean;
  isVip: boolean;
  onInspecter: () => void;
  onAjuster: (delta: number) => void;
}

/** Une ligne de la liste : la fiche s'ouvre au clic n'importe où sauf sur les
 * boutons +/-, qui sont des frères du <Row> cliquable (pas ses enfants) et
 * n'ont donc rien à propager vers son onClick. */
export default function BottleListRow({
  bottle,
  isAdmin,
  isVip,
  onInspecter,
  onAjuster,
}: BottleListRowProps) {
  const isLow = bottle.lowStockThreshold != null && bottle.quantity <= bottle.lowStockThreshold;
  const totalLiters = calculateBottleTotalLiters(bottle);
  const btnClasses =
    "tap-target px-3 rounded-lg border border-rule bg-paper hover:bg-paper-sunk hover:text-terracotta " +
    "text-ink font-bold text-[15px] flex items-center justify-center cursor-pointer";

  return (
    <div className="rounded-xl border border-rule bg-paper overflow-hidden">
      <div className="px-4">
        <Row
          titre={bottle.name}
          sousTitre={`${bottle.type} · ${formatLiters(totalLiters)} en cave`}
          droite={
            <div className="flex items-center gap-1.5">
              {bottle.vip && isVip && <Badge ton="alerte">VIP</Badge>}
              <Badge ton={isLow ? "alerte" : "neutre"}>{bottle.quantity} btl</Badge>
            </div>
          }
          onClick={onInspecter}
          chevron
        />
      </div>
      {isAdmin && (
        <div className="flex items-center justify-end gap-2 px-4 py-2.5 border-t border-rule">
          <button
            onClick={() => onAjuster(-1)}
            disabled={bottle.quantity <= 0}
            aria-label={`Retirer une bouteille de ${bottle.name}`}
            className={`${btnClasses} disabled:opacity-30`}
          >
            −
          </button>
          <button
            onClick={() => onAjuster(1)}
            aria-label={`Ajouter une bouteille de ${bottle.name}`}
            className={btnClasses}
          >
            +
          </button>
        </div>
      )}
    </div>
  );
}
