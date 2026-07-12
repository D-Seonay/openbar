"use client";

import { useState, useTransition } from "react";
import type { AccountUser } from "@/lib/types";
import { toggleRoleAction, toggleVipAction, resetPasswordAction, deleteUserAction } from "./actions";

export default function UserRow({ user }: { user: AccountUser }) {
  const [isPending, startTransition] = useTransition();
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-zinc-900/60 transition-colors">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center font-mono text-xs font-bold text-zinc-400">
          {user.username.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm text-zinc-100">{user.username}</span>
            <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
              {user.role}
            </span>
            {user.vip && (
              <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                VIP
              </span>
            )}
          </div>
          {resetResult && (
            <p className="text-xs font-mono text-emerald-400 mt-1">
              Nouveau MDP : <code className="bg-zinc-950 px-1.5 py-0.5 rounded border border-emerald-500/30">{resetResult}</code>
            </p>
          )}
          {deleteError && <p className="text-xs font-mono text-red-400 mt-1">{deleteError}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(() => toggleRoleAction(user.id, user.role === "ADMIN" ? "USER" : "ADMIN"))
          }
          className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 transition-colors cursor-pointer"
        >
          {user.role === "ADMIN" ? "RÉTROGRADER USER" : "PROMOUVOIR ADMIN"}
        </button>
        <button
          disabled={isPending}
          onClick={() => startTransition(() => toggleVipAction(user.id, !user.vip))}
          className={`px-2.5 py-1.5 rounded-lg border transition-colors cursor-pointer ${
            user.vip
              ? "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
              : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-amber-300"
          }`}
        >
          {user.vip ? "RETIRER VIP" : "ACCORDER VIP"}
        </button>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              const password = await resetPasswordAction(user.id);
              setResetResult(password);
            })
          }
          className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
        >
          RESET MDP
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
          className="px-2.5 py-1.5 rounded-lg bg-red-950/20 hover:bg-red-950/40 border border-red-500/30 text-red-400 transition-colors cursor-pointer"
        >
          SUPPRIMER
        </button>
      </div>
    </div>
  );
}
