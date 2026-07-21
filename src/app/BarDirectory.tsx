// src/app/BarDirectory.tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { BarDirectoryEntry } from "@/lib/types";
import { requestToJoinBarAction } from "@/app/bar-actions";

export default function BarDirectory({
  entries,
  guestMode = false,
}: {
  entries: BarDirectoryEntry[];
  guestMode?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleRequest = (barId: string) => {
    setPendingId(barId);
    startTransition(async () => {
      const result = await requestToJoinBarAction(barId);
      if (result.error) {
        setErrors((prev) => ({ ...prev, [barId]: result.error! }));
      }
      setPendingId(null);
    });
  };

  return (
    <div className="rounded-2xl bg-ink-2/80 border border-white/[0.08] p-6 shadow-xl">
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-3 mb-4">
        <span className="text-xs uppercase tracking-caps text-gold font-bold">Annuaire des Bars</span>
        <span className="text-[11px] text-muted bg-white/[0.05] px-2.5 py-0.5 rounded-full">
          {entries.length} bar{entries.length > 1 ? "s" : ""}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-muted/70 italic py-4">Aucun bar sur la plateforme pour le moment.</p>
      ) : (
        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between p-3.5 rounded-xl bg-ink/70 border border-white/[0.06] hover:border-orange/30 transition-colors"
            >
              <div>
                <p className="font-semibold text-sm text-cream">{entry.name}</p>
                <p className="text-xs text-muted">
                  Par {entry.ownerUsername} · {entry.memberCount} membre{entry.memberCount > 1 ? "s" : ""}
                </p>
                {errors[entry.id] && <p className="text-xs text-red-400 mt-1">{errors[entry.id]}</p>}
              </div>

              {entry.myStatus === "OWNER" && (
                <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-gold/15 text-gold border border-gold/30">
                  Propriétaire
                </span>
              )}
              {entry.myStatus === "MEMBER" && (
                <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-white/[0.05] text-muted border border-white/[0.08]">
                  Membre
                </span>
              )}
              {entry.myStatus === "PENDING" && (
                <span className="text-[10px] uppercase font-bold px-2.5 py-1 rounded-full bg-orange/10 text-orange border border-orange/30">
                  Demande envoyée
                </span>
              )}
              {entry.myStatus === "NONE" &&
                (guestMode ? (
                  <Link
                    href="/signup"
                    className="text-xs px-3 py-1.5 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-orange font-semibold transition-colors"
                  >
                    Créer un compte pour rejoindre
                  </Link>
                ) : (
                  <button
                    disabled={isPending && pendingId === entry.id}
                    onClick={() => handleRequest(entry.id)}
                    className="text-xs px-3 py-1.5 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-orange font-semibold transition-colors cursor-pointer"
                  >
                    Demander à rejoindre
                  </button>
                ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
