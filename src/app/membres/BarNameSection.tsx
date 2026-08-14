// src/app/membres/BarNameSection.tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { renameBarAction } from "@/app/bar-actions";
import { Button } from "@/components/ui";

export default function BarNameSection({ barId, name }: { barId: string; name: string }) {
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setValue(name);
    setSaved(false);
    setError(null);
  }, [barId, name]);

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
    <section className="bg-paper-sunk/40 border border-rule p-5 sm:p-6 rounded-xl space-y-3">
      <div>
        <h2 className="font-display text-[17px] text-ink">Nom du bar</h2>
        <p className="text-ink-soft text-[13px] mt-0.5">Visible par tous les membres et dans l&apos;annuaire.</p>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1 min-h-[44px] bg-paper-sunk border border-rule rounded-xl px-3 py-2 text-[15px] text-ink focus:outline-none focus:border-terracotta"
        />
        <Button variant="principal" disabled={isPending || !value.trim()} onClick={handleSave}>
          {saved ? "Enregistré !" : "Enregistrer"}
        </Button>
      </div>
      {error && <p className="text-[13px] text-terracotta">{error}</p>}
    </section>
  );
}
