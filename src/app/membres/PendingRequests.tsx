// src/app/membres/PendingRequests.tsx
"use client";

import { useState, useTransition } from "react";
import type { PendingJoinRequest } from "@/lib/types";
import { respondToJoinRequestAction } from "@/app/bar-actions";
import { Button } from "@/components/ui";

export default function PendingRequests({ barId, requests }: { barId: string; requests: PendingJoinRequest[] }) {
  const [isPending, startTransition] = useTransition();
  const [handledIds, setHandledIds] = useState<string[]>([]);

  const visible = requests.filter((r) => !handledIds.includes(r.id));
  if (visible.length === 0) return null;

  return (
    <div className="rounded-2xl bg-paper-sunk border border-terracotta/20 p-5 sm:p-6 space-y-3">
      <h2 className="font-display text-[17px] text-ink">Demandes en attente</h2>
      {visible.map((request) => (
        <div
          key={request.id}
          className="flex flex-col xs:flex-row xs:items-center justify-between gap-2.5 p-3 rounded-xl bg-paper border border-rule"
        >
          <div className="flex flex-col min-w-0">
            <span className="text-[15px] text-ink font-semibold">{request.user.username}</span>
            <span className="text-[13px] text-ink-soft mt-0.5">
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
            <Button
              variant="principal"
              disabled={isPending}
              className="flex-1 xs:flex-none"
              onClick={() =>
                startTransition(async () => {
                  await respondToJoinRequestAction(barId, request.id, true);
                  setHandledIds((prev) => [...prev, request.id]);
                })
              }
            >
              Accepter
            </Button>
            <Button
              variant="danger"
              disabled={isPending}
              className="flex-1 xs:flex-none"
              onClick={() =>
                startTransition(async () => {
                  await respondToJoinRequestAction(barId, request.id, false);
                  setHandledIds((prev) => [...prev, request.id]);
                })
              }
            >
              Refuser
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
