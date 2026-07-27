"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiChangePassword } from "@/lib/api-client";
import { getSession, SESSION_COOKIE } from "@/lib/session";

export async function changePasswordAction(
  formData: FormData,
): Promise<{ error: string } | undefined> {
  const session = await getSession();
  if (!session) redirect("/login");

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (newPassword.length < 6) {
    return { error: "Le nouveau mot de passe doit contenir au moins 6 caractères." };
  }
  if (newPassword !== confirmPassword) {
    return { error: "Les deux mots de passe ne correspondent pas." };
  }

  const result = await apiChangePassword(currentPassword, newPassword);
  if ("error" in result) {
    return { error: result.error };
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });

  redirect("/");
}
