"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { apiLogin } from "@/lib/api-client";
import { SESSION_COOKIE } from "@/lib/session";

export async function login(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const redirectTo = String(formData.get("redirectTo") ?? "/");

  if (!username || !password) {
    redirect("/login?error=1");
  }

  const result = await apiLogin(username, password);
  if (!result) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    redirect("/login?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect(redirectTo);
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  redirect("/login");
}
