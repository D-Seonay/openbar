// src/app/membres/InviteLinkSection.tsx
"use client";

import { useState, useTransition } from "react";
import { generateInviteLinkAction } from "@/app/bar-actions";

export default function InviteLinkSection({ barId, inviteToken }: { barId: string; inviteToken: string | null }) {
  const [isPending, startTransition] = useTransition();
  const [token, setToken] = useState(inviteToken);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const link = token
    ? typeof window !== "undefined"
      ? `${window.location.origin}/rejoindre/${token}`
      : `/rejoindre/${token}`
    : null;

  const handleGenerate = () => {
    setError(null);
    startTransition(async () => {
      const result = await generateInviteLinkAction(barId);
      if (result.error) setError(result.error);
      else if (result.inviteToken) setToken(result.inviteToken);
    });
  };

  const handleCopy = () => {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="bg-ink-2/40 border border-orange/10 p-5 sm:p-6 rounded-xl space-y-3">
      <div>
        <h2 className="font-display text-xl text-cream">Lien d&apos;invitation</h2>
        <p className="text-muted text-[11px] mt-0.5">
          Toute personne avec ce lien peut rejoindre le bar, avec ou sans compte existant.
        </p>
      </div>
      {token ? (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link ?? ""}
            className="flex-1 bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs text-cream"
          />
          <button
            onClick={handleCopy}
            className="text-xs px-3 py-2 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-orange font-semibold transition-colors cursor-pointer"
          >
            {copied ? "Copié !" : "Copier"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted/70 italic">Aucun lien généré pour le moment.</p>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button
        disabled={isPending}
        onClick={handleGenerate}
        className="text-xs px-3 py-2 rounded-xl bg-ink border border-white/[0.1] text-cream hover:border-orange/50 transition-colors cursor-pointer"
      >
        {token ? "Régénérer le lien" : "Générer un lien"}
      </button>
    </section>
  );
}
