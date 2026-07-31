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
    <select
      value={activeBarId}
      disabled={isPending}
      onChange={(e) => startTransition(() => switchBarAction(e.target.value))}
      aria-label="Changer de bar"
      className={`max-w-[9rem] sm:max-w-none truncate bg-ink border border-white/[0.08] rounded-xl px-3 py-2 text-xs text-cream focus:outline-none focus:border-orange transition-all cursor-pointer ${className}`}
    >
      {bars.map((bar) => (
        <option key={bar.id} value={bar.id}>
          {bar.name}
        </option>
      ))}
    </select>
  );
}
