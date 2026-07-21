// src/app/membres/BarVisibilitySection.tsx
"use client";

import { useTransition } from "react";
import { setBarVisibilityAction } from "@/app/bar-actions";

export default function BarVisibilitySection({ barId, isPublic }: { barId: string; isPublic: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <section className="bg-ink-2/40 border border-orange/10 p-6 rounded-xl space-y-3">
      <div>
        <h2 className="font-display text-xl text-cream">Visibilité du bar</h2>
        <p className="text-muted text-[11px] mt-0.5">
          {isPublic
            ? "Ce bar apparaît dans l'annuaire public et celui des comptes connectés."
            : "Ce bar est privé : invisible sauf invitation directe ou lien."}
        </p>
      </div>
      <label className="flex items-center gap-2.5 text-xs text-cream cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isPublic}
          disabled={isPending}
          onChange={(e) => startTransition(() => setBarVisibilityAction(barId, e.target.checked))}
          className="w-5 h-5 rounded border-orange/30 text-orange focus:ring-orange bg-ink accent-orange cursor-pointer"
        />
        <span className="font-medium">Bar public (visible dans l&apos;annuaire)</span>
      </label>
    </section>
  );
}
