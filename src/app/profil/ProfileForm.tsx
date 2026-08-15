"use client";

import { useState, useTransition } from "react";
import type { MyProfile } from "@/lib/types";
import { uploadProfileImage } from "@/app/actions";
import ImagePicker from "@/components/ImagePicker";
import { updateProfileAction } from "./actions";
import { Button, Field, champClasses } from "@/components/ui";

export default function ProfileForm({ profile }: { profile: MyProfile }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatarUrl ?? "");

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const result = await updateProfileAction(formData);
      if (result?.error) {
        setError(result.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    });
  };

  return (
    <form action={handleSubmit} className="space-y-4">
      <input type="hidden" name="avatarUrl" value={avatarUrl} />
      <ImagePicker
        value={avatarUrl}
        onChange={setAvatarUrl}
        onUpload={uploadProfileImage}
        label="Photo de profil"
      />

      <Field label="Anniversaire" htmlFor="birthday">
        <input
          id="birthday"
          name="birthday"
          type="date"
          defaultValue={profile.birthday ? profile.birthday.slice(0, 10) : ""}
          className={champClasses}
        />
      </Field>

      <Field label="Boisson préférée" htmlFor="favoriteDrink">
        <input
          id="favoriteDrink"
          name="favoriteDrink"
          defaultValue={profile.favoriteDrink ?? ""}
          placeholder="Ex: Mojito"
          className={champClasses}
        />
      </Field>

      <Field label="Allergies / restrictions" htmlFor="allergies">
        <input
          id="allergies"
          name="allergies"
          defaultValue={profile.allergies ?? ""}
          placeholder="Ex: Fruits à coque, sans alcool..."
          className={champClasses}
        />
      </Field>

      {error && (
        <p className="text-[13px] text-terracotta" role="alert">
          {error}
        </p>
      )}

      <Button type="submit" disabled={isPending} pleineLargeur>
        {isPending ? "Enregistrement..." : "Enregistrer mon profil"}
      </Button>

      {saved && (
        <div className="text-[13px] bg-paper-sunk border border-done/35 rounded-xl p-3 text-done text-center font-semibold uppercase tracking-caps">
          ✓ Profil enregistré !
        </div>
      )}
    </form>
  );
}
