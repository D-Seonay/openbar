"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMyProfile, updateMyProfile } from "@/lib/api-client";
import { getSession } from "@/lib/session";

export async function updateProfileAction(
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const session = await getSession();
  if (!session) redirect("/login");

  const birthday = String(formData.get("birthday") ?? "").trim();
  const favoriteDrink = String(formData.get("favoriteDrink") ?? "").trim();
  const allergies = String(formData.get("allergies") ?? "").trim();
  const avatarUrl = String(formData.get("avatarUrl") ?? "").trim();

  const input: {
    birthday?: string;
    favoriteDrink: string;
    allergies: string;
    avatarUrl: string;
  } = { favoriteDrink, allergies, avatarUrl };
  if (birthday) input.birthday = birthday;

  try {
    await updateMyProfile(input);
  } catch {
    return { error: "Impossible d'enregistrer le profil." };
  }

  revalidatePath("/profil");
  revalidatePath("/annuaire");
}

export async function getMyProfileForForm() {
  const session = await getSession();
  if (!session) redirect("/login");
  return getMyProfile();
}
