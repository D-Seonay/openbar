"use client";

import { useState, useTransition } from "react";
import type { AccountUser } from "@/lib/types";
import { toggleRoleAction, toggleVipAction, resetPasswordAction, deleteUserAction } from "./actions";

export default function UserRow({ user }: { user: AccountUser }) {
  const [isPending, startTransition] = useTransition();
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-ink-2 transition-colors">
      <div className="flex items-center gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-ink border border-white/[0.08] flex items-center justify-center font-display text-sm font-bold text-gold">
          {user.username.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-sm text-cream">{user.username}</span>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-white/[0.05] text-muted">
              {user.role}
            </span>
            {user.vip && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gold text-ink shadow-sm">
                VIP
              </span>
            )}
          </div>
          {resetResult && (
            <p className="text-xs text-emerald-400 mt-1 font-mono">
              Nouveau mot de passe : <code className="bg-ink px-2 py-0.5 rounded border border-emerald-500/30">{resetResult}</code>
            </p>
          )}
          {deleteError && <p className="text-xs text-red-400 mt-1">{deleteError}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(() => toggleRoleAction(user.id, user.role === "ADMIN" ? "USER" : "ADMIN"))
          }
          className="px-3 py-1.5 rounded-xl bg-ink hover:bg-white/[0.06] border border-white/[0.08] text-cream transition-colors cursor-pointer"
        >
          {user.role === "ADMIN" ? "Rétrograder User" : "Promouvoir Admin"}
        </button>
        <button
          disabled={isPending}
          onClick={() => startTransition(() => toggleVipAction(user.id, !user.vip))}
          className={`px-3 py-1.5 rounded-xl border transition-colors cursor-pointer font-semibold ${
            user.vip
              ? "bg-gold/15 border-gold/40 text-gold hover:bg-gold/25"
              : "bg-ink border-white/[0.08] text-muted hover:text-gold"
          }`}
        >
          {user.vip ? "Retirer accès VIP" : "Accorder VIP"}
        </button>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const password = await resetPasswordAction(user.id);
              setResetResult(password);
            })
          }
          className="px-3 py-1.5 rounded-xl bg-ink hover:bg-white/[0.06] border border-white/[0.08] text-muted hover:text-cream transition-colors cursor-pointer"
        >
          Réinitialiser MDP
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
          className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors cursor-pointer"
        >
          Supprimer
        </button>
      </div>
    </div>
  );
}
