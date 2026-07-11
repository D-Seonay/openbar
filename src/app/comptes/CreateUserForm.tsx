"use client";

import { useState, useTransition } from "react";
import { createUserAction } from "./actions";

export default function CreateUserForm() {
  const [isPending, startTransition] = useTransition();
  const [generatedPassword, setGeneratedPassword] = useState<{ username: string; password: string } | null>(null);

  return (
    <section className="bg-ink-2/40 border border-orange/10 p-6 rounded-xl space-y-4">
      <div>
        <h2 className="font-display text-xl text-cream">Créer un compte</h2>
        <p className="text-muted text-[11px] mt-0.5">Un mot de passe temporaire est généré automatiquement.</p>
      </div>
      <form
        action={(formData) => {
          startTransition(async () => {
            const result = await createUserAction(formData);
            if (result) setGeneratedPassword(result);
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
          Réserve VIP
        </label>
        <select
          name="role"
          className="w-full bg-ink border border-orange/10 rounded-xl px-3 py-2 text-xs text-cream"
        >
          <option value="USER">Utilisateur</option>
          <option value="ADMIN">Administrateur</option>
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-orange text-white font-medium rounded-xl py-2.5 hover:bg-orange-hover transition-all text-xs uppercase tracking-wider font-semibold"
        >
          Créer le compte
        </button>
      </form>
      {generatedPassword && (
        <div className="text-xs bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-emerald-300">
          Compte <strong>{generatedPassword.username}</strong> créé. Mot de passe temporaire :{" "}
          <code className="font-mono bg-black/30 px-1.5 py-0.5 rounded">{generatedPassword.password}</code>
        </div>
      )}
    </section>
  );
}
