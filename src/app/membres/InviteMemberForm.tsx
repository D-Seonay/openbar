"use client";

import { useState, useTransition } from "react";
import { inviteMemberAction } from "@/app/bar-actions";

export default function InviteMemberForm({ barId }: { barId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <section className="bg-ink-2/40 border border-orange/10 p-6 rounded-xl space-y-4">
      <div>
        <h2 className="font-display text-xl text-cream">Inviter un membre</h2>
        <p className="text-muted text-[11px] mt-0.5">Par identifiant d&apos;un compte existant.</p>
      </div>
      <form
        action={(formData) => {
          setError(null);
          startTransition(async () => {
            const result = await inviteMemberAction(barId, formData);
            if (result.error) setError(result.error);
          });
        }}
        className="space-y-3.5"
      >
        <input
          name="username"
          required
          placeholder="Identifiant"
          className="w-full bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs placeholder:text-muted/40 focus:outline-none focus:border-orange transition-all text-cream"
        />
        <label className="flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" name="vip" className="accent-gold" />
          Accès VIP sur ce bar
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-orange text-white font-medium rounded-xl py-2.5 hover:bg-orange-hover transition-all text-xs uppercase tracking-wider font-semibold"
        >
          Inviter
        </button>
      </form>
      {error && (
        <div className="text-xs bg-red-950/30 border border-red-500/30 rounded-xl p-3 text-red-300">{error}</div>
      )}
    </section>
  );
}
