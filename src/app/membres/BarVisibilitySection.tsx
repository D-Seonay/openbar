// src/app/membres/BarVisibilitySection.tsx
"use client";

import { useTransition } from "react";
import { setBarVisibilityAction } from "@/app/bar-actions";

export default function BarVisibilitySection({ barId, isPublic }: { barId: string; isPublic: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <section className="bg-paper-sunk/40 border border-rule p-5 sm:p-6 rounded-xl space-y-3">
      <div>
        <h2 className="font-display text-[17px] text-ink">Visibilité du bar</h2>
        <p className="text-ink-soft text-[13px] mt-0.5">
          {isPublic
            ? "Ce bar apparaît dans l'annuaire public et celui des comptes connectés."
            : "Ce bar est privé : invisible sauf invitation directe ou lien."}
        </p>
      </div>
      <label className="flex items-center gap-2.5 text-[15px] text-ink cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isPublic}
          disabled={isPending}
          onChange={(e) => startTransition(() => setBarVisibilityAction(barId, e.target.checked))}
          className="tap-target shrink-0 rounded border-rule text-terracotta focus:ring-terracotta bg-paper-sunk accent-terracotta cursor-pointer"
        />
        <span className="font-medium">Bar public (visible dans l&apos;annuaire)</span>
      </label>
    </section>
  );
}
