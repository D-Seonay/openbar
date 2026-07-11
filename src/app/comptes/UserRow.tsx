"use client";

import { useState, useTransition } from "react";
import type { AccountUser } from "@/lib/types";
import { toggleRoleAction, toggleVipAction, resetPasswordAction, deleteUserAction } from "./actions";

export default function UserRow({ user }: { user: AccountUser }) {
  const [isPending, startTransition] = useTransition();
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="rounded-xl border border-orange/10 bg-ink-2/40 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div>
        <p className="font-display text-cream">{user.username}</p>
        <p className="text-[10px] text-muted mt-0.5">
          {user.role === "ADMIN" ? "Administrateur" : "Utilisateur"}
          {user.vip && " · VIP"}
        </p>
        {resetResult && (
          <p className="text-[10px] text-emerald-300 mt-1">
            Nouveau mot de passe : <code className="font-mono bg-black/30 px-1 rounded">{resetResult}</code>
          </p>
        )}
        {deleteError && <p className="text-[10px] text-red-400 mt-1">{deleteError}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[10px]">
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(() => toggleRoleAction(user.id, user.role === "ADMIN" ? "USER" : "ADMIN"))
          }
          className="px-2.5 py-1 rounded-lg border border-orange/20 text-muted hover:text-cream transition-colors"
        >
          {user.role === "ADMIN" ? "Rétrograder" : "Promouvoir admin"}
        </button>
        <button
          disabled={isPending}
          onClick={() => startTransition(() => toggleVipAction(user.id, !user.vip))}
          className="px-2.5 py-1 rounded-lg border border-gold/20 text-gold hover:bg-gold/10 transition-colors"
        >
          {user.vip ? "Retirer VIP" : "Passer VIP"}
        </button>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const password = await resetPasswordAction(user.id);
              setResetResult(password);
            })
          }
          className="px-2.5 py-1 rounded-lg border border-orange/20 text-muted hover:text-cream transition-colors"
        >
          Réinitialiser le mot de passe
        </button>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setDeleteError(null);
              const result = await deleteUserAction(user.id);
              if (result.error) setDeleteError(result.error);
            })
          }
          className="px-2.5 py-1 rounded-lg border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-colors"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
