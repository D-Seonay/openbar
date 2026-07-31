// src/app/membres/PendingRequests.tsx
"use client";

import { useState, useTransition } from "react";
import type { PendingJoinRequest } from "@/lib/types";
import { respondToJoinRequestAction } from "@/app/bar-actions";

export default function PendingRequests({ barId, requests }: { barId: string; requests: PendingJoinRequest[] }) {
  const [isPending, startTransition] = useTransition();
  const [handledIds, setHandledIds] = useState<string[]>([]);

  const visible = requests.filter((r) => !handledIds.includes(r.id));
  if (visible.length === 0) return null;

  return (
    <div className="rounded-2xl bg-ink-2 border border-orange/20 p-5 sm:p-6 shadow-xl space-y-3">
      <h2 className="font-display text-xl text-cream">Demandes en attente</h2>
      {visible.map((request) => (
        <div
          key={request.id}
          className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 p-3 rounded-xl bg-ink border border-white/[0.08]"
        >
          <div className="flex flex-col min-w-0">
            <span className="text-sm text-cream font-semibold">{request.user.username}</span>
            <span className="text-[10px] text-muted mt-0.5">
              Le {new Date(request.createdAt).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await respondToJoinRequestAction(barId, request.id, true);
                  setHandledIds((prev) => [...prev, request.id]);
                })
              }
              className="tap-target-sm flex-1 xs:flex-none flex items-center justify-center text-xs px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-400 font-semibold transition-colors cursor-pointer"
            >
              Accepter
            </button>
            <button
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await respondToJoinRequestAction(barId, request.id, false);
                  setHandledIds((prev) => [...prev, request.id]);
                })
              }
              className="tap-target-sm flex-1 xs:flex-none flex items-center justify-center text-xs px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-semibold transition-colors cursor-pointer"
            >
              Refuser
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
