"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "./actions";

export default function ChangePasswordForm() {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await changePasswordAction(formData);
      if (result?.error) setError(result.error);
    });
  };

  return (
    <form action={handleSubmit} className="space-y-3">
      <input
        name="currentPassword"
        type="password"
        placeholder="Mot de passe temporaire actuel"
        required
        autoComplete="current-password"
        className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-3 text-sm sm:text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
      />
      <input
        name="newPassword"
        type="password"
        placeholder="Nouveau mot de passe (6 caractères min.)"
        required
        minLength={6}
        autoComplete="new-password"
        className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-3 text-sm sm:text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
      />
      <input
        name="confirmPassword"
        type="password"
        placeholder="Confirmer le nouveau mot de passe"
        required
        minLength={6}
        autoComplete="new-password"
        className="w-full bg-ink border border-orange/15 rounded-xl px-4 py-3 text-sm sm:text-xs text-center placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
      />
      {error && <p className="text-xs text-red-400 text-center">{error}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-orange text-white font-medium rounded-xl py-3 hover:bg-orange-hover box-orange-glow transition-all uppercase tracking-wider text-xs font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? "Modification en cours..." : "Changer mon mot de passe"}
      </button>
    </form>
  );
}
