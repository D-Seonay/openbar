// src/app/membres/InviteLinkSection.tsx
"use client";

import { useState, useTransition } from "react";
import { generateInviteLinkAction } from "@/app/bar-actions";
import { Button } from "@/components/ui";

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
    <section className="bg-paper-sunk/40 border border-rule p-5 sm:p-6 rounded-xl space-y-3">
      <div>
        <h2 className="font-display text-[17px] text-ink">Lien d&apos;invitation</h2>
        <p className="text-ink-soft text-[13px] mt-0.5">
          Toute personne avec ce lien peut rejoindre le bar, avec ou sans compte existant.
        </p>
      </div>
      {token ? (
        <div className="flex items-center gap-2">
          <input
            readOnly
            value={link ?? ""}
            className="flex-1 min-h-[44px] bg-paper-sunk border border-rule rounded-xl px-3 py-2 text-[13px] text-ink"
          />
          <Button variant="principal" onClick={handleCopy}>
            {copied ? "Copié !" : "Copier"}
          </Button>
        </div>
      ) : (
        <p className="text-[13px] text-ink-soft italic">Aucun lien généré pour le moment.</p>
      )}
      {error && <p className="text-[13px] text-terracotta">{error}</p>}
      <Button variant="discret" disabled={isPending} onClick={handleGenerate}>
        {token ? "Régénérer le lien" : "Générer un lien"}
      </Button>
    </section>
  );
}
