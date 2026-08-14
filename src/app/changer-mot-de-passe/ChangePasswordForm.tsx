"use client";

import { useState, useTransition } from "react";
import { changePasswordAction } from "./actions";
import { Button, Field, champClasses } from "@/components/ui";

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
    <form action={handleSubmit}>
      <Field label="Mot de passe temporaire actuel" htmlFor="change-current-password">
        <input
          id="change-current-password"
          name="currentPassword"
          type="password"
          placeholder="Mot de passe temporaire actuel"
          required
          autoComplete="current-password"
          className={champClasses}
        />
      </Field>
      <Field label="Nouveau mot de passe" htmlFor="change-new-password" aide="6 caractères min.">
        <input
          id="change-new-password"
          name="newPassword"
          type="password"
          placeholder="Nouveau mot de passe (6 caractères min.)"
          required
          minLength={6}
          autoComplete="new-password"
          className={champClasses}
        />
      </Field>
      <Field label="Confirmer le nouveau mot de passe" htmlFor="change-confirm-password">
        <input
          id="change-confirm-password"
          name="confirmPassword"
          type="password"
          placeholder="Confirmer le nouveau mot de passe"
          required
          minLength={6}
          autoComplete="new-password"
          className={champClasses}
        />
      </Field>
      {error && <p className="text-[13px] text-terracotta text-center mb-4">{error}</p>}
      <Button type="submit" pleineLargeur disabled={isPending}>
        {isPending ? "Modification en cours..." : "Changer mon mot de passe"}
      </Button>
    </form>
  );
}
