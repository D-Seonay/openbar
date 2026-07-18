"use client";

import { useTransition } from "react";
import type { Bar } from "@/lib/types";
import { switchBarAction } from "@/app/bar-actions";

export default function BarSwitcher({ bars, activeBarId }: { bars: Bar[]; activeBarId: string }) {
  const [isPending, startTransition] = useTransition();

  if (bars.length <= 1) return null;

  return (
    <select
      value={activeBarId}
      disabled={isPending}
      onChange={(e) => startTransition(() => switchBarAction(e.target.value))}
      className="bg-ink border border-white/[0.08] rounded-xl px-3 py-1.5 text-xs text-cream focus:outline-none focus:border-orange transition-all cursor-pointer"
    >
      {bars.map((bar) => (
        <option key={bar.id} value={bar.id}>
          {bar.name}
        </option>
      ))}
    </select>
  );
}
