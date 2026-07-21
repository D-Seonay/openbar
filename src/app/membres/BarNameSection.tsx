// src/app/membres/BarNameSection.tsx
"use client";

import { useState, useTransition } from "react";
import { renameBarAction } from "@/app/bar-actions";

export default function BarNameSection({ barId, name }: { barId: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const result = await renameBarAction(barId, value);
      if (result.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  };

  return (
    <section className="bg-ink-2/40 border border-orange/10 p-6 rounded-xl space-y-3">
      <div>
        <h2 className="font-display text-xl text-cream">Nom du bar</h2>
        <p className="text-muted text-[11px] mt-0.5">Visible par tous les membres et dans l&apos;annuaire.</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs text-cream focus:outline-none focus:border-orange"
        />
        <button
          disabled={isPending || !value.trim()}
          onClick={handleSave}
          className="text-xs px-3 py-2 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-orange font-semibold transition-colors cursor-pointer"
        >
          {saved ? "Enregistré !" : "Enregistrer"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </section>
  );
}
