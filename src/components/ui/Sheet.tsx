"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";

interface SheetProps {
  ouvert: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
}

export default function Sheet({ ouvert, titre, onFermer, children }: SheetProps) {
  useEffect(() => {
    if (!ouvert) return;
    const surTouche = (e: KeyboardEvent) => {
      if (e.key === "Escape") onFermer();
    };
    document.addEventListener("keydown", surTouche);
    // Sans cela, le fond continue de défiler derrière la feuille sur iOS.
    const overflowPrecedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", surTouche);
      document.body.style.overflow = overflowPrecedent;
    };
  }, [ouvert, onFermer]);

  if (!ouvert) return null;

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Fermer"
        onClick={onFermer}
        className="absolute inset-0 bg-ink/40"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titre}
        className="relative bg-paper rounded-t-2xl border-t border-rule
          max-h-[88vh] flex flex-col pb-safe-0"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-rule">
          <h2 className="font-display text-[17px] text-ink truncate">{titre}</h2>
          <button
            type="button"
            onClick={onFermer}
            aria-label="Fermer"
            className="min-h-[44px] min-w-[44px] -mr-2 flex items-center justify-center
              text-ink-soft text-[20px]"
          >
            ×
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
