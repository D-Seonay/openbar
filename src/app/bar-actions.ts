"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import * as api from "@/lib/api-client";
import { SESSION_COOKIE, getSession } from "@/lib/session";
import { ACTIVE_BAR_COOKIE } from "@/lib/active-bar";

export async function signup(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!username || password.length < 6 || password !== confirmPassword) {
    redirect("/signup?error=1");
  }

  const result = await api.apiSignup(username, password);
  if (!result) {
    redirect("/signup?error=1");
  }

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === "true",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/creer");
}

async function requireSession() {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function createBarAction(formData: FormData) {
  await requireSession();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) redirect("/creer?error=1");

  await api.createBar(name);
  redirect("/");
}

export async function switchBarAction(barId: string) {
  await requireSession();
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_BAR_COOKIE, barId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  revalidatePath("/");
}
