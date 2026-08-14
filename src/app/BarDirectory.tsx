// src/app/BarDirectory.tsx
"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { BarDirectoryEntry } from "@/lib/types";
import { requestToJoinBarAction } from "@/app/bar-actions";
import { Badge, Button, Row } from "@/components/ui";

const ACTION_LINK_CLASSES =
  "min-h-[44px] px-4 rounded-lg border text-[15px] font-semibold " +
  "inline-flex items-center justify-center gap-2 transition-colors " +
  "bg-terracotta text-paper hover:bg-terracotta/90 border-transparent";

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
    <div className="rounded-2xl bg-paper border border-rule p-5 sm:p-6">
      <div className="flex items-center justify-between border-b border-rule pb-3 mb-4">
        <span className="text-[13px] uppercase tracking-caps text-terracotta font-bold">Annuaire des Bars</span>
        <span className="text-[13px] text-ink-soft bg-paper-sunk px-2.5 py-0.5 rounded-full">
          {entries.length} bar{entries.length > 1 ? "s" : ""}
        </span>
      </div>

      {entries.length === 0 ? (
        <p className="text-[15px] text-ink-soft/70 italic py-4">Aucun bar sur la plateforme pour le moment.</p>
      ) : (
        <div className="space-y-2.5 max-h-[320px] overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="rounded-xl border border-rule bg-paper-sunk/70 px-3.5 hover:border-terracotta/30 transition-colors"
            >
              <Row
                titre={entry.name}
                sousTitre={
                  <>
                    Par {entry.ownerUsername} · {entry.memberCount} membre
                    {entry.memberCount > 1 ? "s" : ""}
                    {errors[entry.id] && (
                      <span className="block text-terracotta mt-1">{errors[entry.id]}</span>
                    )}
                  </>
                }
                droite={
                  <>
                    {entry.myStatus === "OWNER" && <Badge ton="complet">Propriétaire</Badge>}
                    {entry.myStatus === "MEMBER" && <Badge>Membre</Badge>}
                    {entry.myStatus === "PENDING" && <Badge ton="alerte">Demande envoyée</Badge>}
                    {entry.myStatus === "NONE" &&
                      (guestMode ? (
                        <Link href="/signup" className={ACTION_LINK_CLASSES}>
                          Créer un compte pour rejoindre
                        </Link>
                      ) : (
                        <Button
                          variant="principal"
                          disabled={isPending && pendingId === entry.id}
                          onClick={() => handleRequest(entry.id)}
                        >
                          Demander à rejoindre
                        </Button>
                      ))}
                  </>
                }
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
