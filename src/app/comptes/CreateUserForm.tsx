"use client";

import { useState, useTransition } from "react";
import { createUserAction } from "./actions";
import { Button } from "@/components/ui";

export default function CreateUserForm() {
  const [isPending, startTransition] = useTransition();
  const [generatedPassword, setGeneratedPassword] = useState<{ username: string; password: string } | null>(null);

  return (
    <section className="bg-paper-sunk/40 border border-rule p-5 sm:p-6 rounded-xl space-y-4">
      <div>
        <h2 className="font-display text-[17px] text-ink">Créer un compte</h2>
        <p className="text-ink-soft text-[13px] mt-0.5">Un mot de passe temporaire est généré automatiquement.</p>
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
          className="w-full min-h-[44px] bg-paper-sunk border border-rule rounded-xl px-3 py-2 text-[15px] placeholder:text-ink-soft focus:outline-none focus:border-terracotta transition-all text-ink"
        />
        <label className="flex items-center gap-2 text-[13px] text-ink-soft">
          <input
            type="checkbox"
            name="vip"
            className="tap-target shrink-0 rounded border-rule accent-terracotta cursor-pointer"
          />
          Réserve VIP
        </label>
        <select
          name="role"
          className="w-full min-h-[44px] bg-paper-sunk border border-rule rounded-xl px-3 py-2 text-[15px] text-ink"
        >
          <option value="USER">Utilisateur</option>
          <option value="ADMIN">Administrateur</option>
        </select>
        <Button type="submit" pleineLargeur disabled={isPending}>
          Créer le compte
        </Button>
      </form>
      {generatedPassword && (
        <div className="text-[13px] bg-paper-sunk border border-done/35 rounded-xl p-3 text-done">
          Compte <strong>{generatedPassword.username}</strong> créé. Mot de passe temporaire :{" "}
          <code className="font-mono bg-paper px-1.5 py-0.5 rounded">{generatedPassword.password}</code>
        </div>
      )}
    </section>
  );
}
