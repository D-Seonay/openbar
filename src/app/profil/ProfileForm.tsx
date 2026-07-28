"use client";

import { useState, useTransition } from "react";
import type { MyProfile } from "@/lib/types";
import { uploadProfileImage } from "@/app/actions";
import ImagePicker from "@/components/ImagePicker";
import { updateProfileAction } from "./actions";

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

      <div>
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">
          Anniversaire
        </label>
        <input
          name="birthday"
          type="date"
          defaultValue={profile.birthday ? profile.birthday.slice(0, 10) : ""}
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">
          Boisson préférée
        </label>
        <input
          name="favoriteDrink"
          defaultValue={profile.favoriteDrink ?? ""}
          placeholder="Ex: Mojito"
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      <div>
        <label className="text-xs uppercase tracking-caps text-gold-dim mb-1.5 block">
          Allergies / restrictions
        </label>
        <input
          name="allergies"
          defaultValue={profile.allergies ?? ""}
          placeholder="Ex: Fruits à coque, sans alcool..."
          className="w-full bg-ink border border-orange/20 rounded-lg px-3 py-2 text-sm placeholder:text-muted/40 focus:outline-none focus:border-orange focus:bg-ink-2/30 transition-all text-cream"
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="w-full bg-orange text-ink font-semibold rounded-lg py-2.5 hover:bg-cream transition-colors uppercase tracking-caps text-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? "Enregistrement..." : "Enregistrer mon profil"}
      </button>

      {saved && (
        <div className="text-xs bg-emerald-950/30 border border-emerald-500/30 rounded-xl p-3 text-emerald-300 text-center font-semibold uppercase tracking-caps">
          ✓ Profil enregistré !
        </div>
      )}
    </form>
  );
}
