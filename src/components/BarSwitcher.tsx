"use client";

import { useTransition } from "react";
import type { Bar } from "@/lib/types";
import { switchBarAction } from "@/app/bar-actions";

export default function BarSwitcher({
  bars,
  activeBarId,
  className = "",
}: {
  bars: Bar[];
  activeBarId: string;
  className?: string;
}) {
  const [isPending, startTransition] = useTransition();

  if (bars.length <= 1) return null;

  return (
    <div className={`relative shrink-0 ${className}`}>
      <select
        value={activeBarId}
        disabled={isPending}
        onChange={(e) => startTransition(() => switchBarAction(e.target.value))}
        aria-label="Changer de bar"
        // `appearance-none` n'est pas cosmétique : un <select> laissé en
        // `appearance: auto` ignore `min-height` sur WebKit, où la hauteur reste
        // celle du contrôle natif (26px mesurés, min-height calculé à 18px). Sans
        // lui, la classe `tap-target` ne produit rien et la cible passe sous les
        // 44px sur toutes les pages, puisque ce sélecteur vit dans le bandeau.
        //
        // Mais le retirer supprime aussi la flèche native : sans le chevron
        // dessiné ci-dessous, le contrôle devient indistinguable d'une étiquette
        // et plus rien n'indique qu'on peut changer de bar. D'où `pr-8`, qui lui
        // réserve la place.
        className="tap-target appearance-none w-full max-w-[9rem] sm:max-w-[14rem] truncate bg-paper-sunk border border-rule rounded-xl pl-3 pr-8 py-2 text-[13px] text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta transition-all cursor-pointer"
      >
        {bars.map((bar) => (
          <option key={bar.id} value={bar.id}>
            {bar.name}
          </option>
        ))}
      </select>
      <span
        aria-hidden
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-ink-soft"
      >
        ▾
      </span>
    </div>
  );
}
