"use client";

import { useState, useTransition } from "react";
import type { BarMember } from "@/lib/types";
import { toggleMemberVipAction, removeMemberAction, changeMemberRoleAction } from "@/app/bar-actions";

export default function MemberRow({ barId, member }: { barId: string; member: BarMember }) {
  const [isPending, startTransition] = useTransition();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-ink-2 transition-colors">
      <div className="flex items-center gap-3.5">
        <div className="w-9 h-9 rounded-xl bg-ink border border-white/[0.08] flex items-center justify-center font-display text-sm font-bold text-gold">
          {member.user.username.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-sm text-cream">{member.user.username}</span>
            <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-white/[0.05] text-muted">
              {member.role === "OWNER" ? "Propriétaire" : "Membre"}
            </span>
            {member.vip && (
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-gold text-ink shadow-sm">
                VIP
              </span>
            )}
          </div>
          {deleteError && <p className="text-xs text-red-400 mt-1">{deleteError}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setDeleteError(null);
              const role = member.role === "OWNER" ? "MEMBER" : "OWNER";
              const result = await changeMemberRoleAction(barId, member.id, role);
              if (result.error) setDeleteError(result.error);
            })
          }
          className="px-3 py-1.5 rounded-xl bg-ink border border-white/[0.08] text-cream transition-colors cursor-pointer hover:bg-ink-2 hover:border-white/[0.12]"
        >
          {member.role === "OWNER" ? "Rétrograder membre" : "Promouvoir proprio"}
        </button>
        <button
          disabled={isPending}
          onClick={() => startTransition(() => toggleMemberVipAction(barId, member.id, !member.vip))}
          className={`px-3 py-1.5 rounded-xl border transition-colors cursor-pointer font-semibold ${
            member.vip
              ? "bg-gold/15 border-gold/40 text-gold hover:bg-gold/25"
              : "bg-ink border-white/[0.08] text-muted hover:text-gold"
          }`}
        >
          {member.vip ? "Retirer VIP" : "Accorder VIP"}
        </button>
        <button
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              setDeleteError(null);
              const result = await removeMemberAction(barId, member.id);
              if (result.error) setDeleteError(result.error);
            })
          }
          className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 transition-colors cursor-pointer"
        >
          Révoquer
        </button>
      </div>
    </div>
  );
}
