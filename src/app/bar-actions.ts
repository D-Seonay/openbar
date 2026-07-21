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
  const inviteToken = formData.get("inviteToken");

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

  if (typeof inviteToken === "string" && inviteToken) {
    await api.joinViaInviteLinkWithToken(inviteToken, result.token);
    redirect("/");
  }

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

export async function inviteMemberAction(barId: string, formData: FormData): Promise<{ error?: string }> {
  await requireSession();
  const username = String(formData.get("username") ?? "").trim();
  const vip = formData.get("vip") === "on";
  if (!username) return { error: "Nom d'utilisateur requis" };

  try {
    await api.inviteBarMember(barId, username, vip);
    revalidatePath("/membres");
    return {};
  } catch (err) {
    return { error: err instanceof api.ApiError ? err.message : "Erreur lors de l'invitation" };
  }
}

export async function toggleMemberVipAction(barId: string, membershipId: string, vip: boolean) {
  await requireSession();
  await api.updateBarMemberVip(barId, membershipId, vip);
  revalidatePath("/membres");
}

export async function removeMemberAction(barId: string, membershipId: string): Promise<{ error?: string }> {
  await requireSession();
  try {
    await api.removeBarMember(barId, membershipId);
    revalidatePath("/membres");
    return {};
  } catch (err) {
    return { error: err instanceof api.ApiError ? err.message : "Erreur lors de la révocation" };
  }
}

export async function requestToJoinBarAction(barId: string): Promise<{ error?: string }> {
  await requireSession();
  try {
    await api.requestToJoinBar(barId);
    revalidatePath("/");
    return {};
  } catch (err) {
    return { error: err instanceof api.ApiError ? err.message : "Erreur lors de la demande" };
  }
}

export async function respondToJoinRequestAction(barId: string, requestId: string, accept: boolean) {
  await requireSession();
  await api.respondToJoinRequest(barId, requestId, accept);
  revalidatePath("/membres");
}

export async function setBarVisibilityAction(barId: string, isPublic: boolean) {
  await requireSession();
  await api.updateBarVisibility(barId, isPublic);
  revalidatePath("/membres");
}

export async function generateInviteLinkAction(barId: string): Promise<{ inviteToken?: string; error?: string }> {
  await requireSession();
  try {
    const result = await api.generateInviteLink(barId);
    revalidatePath("/membres");
    return { inviteToken: result.inviteToken };
  } catch (err) {
    return { error: err instanceof api.ApiError ? err.message : "Erreur lors de la génération du lien" };
  }
}

export async function searchUsersAction(query: string) {
  await requireSession();
  if (!query.trim()) return [];
  try {
    return await api.searchUsers(query);
  } catch {
    return [];
  }
}

export async function joinViaInviteLinkAction(token: string) {
  await requireSession();
  await api.joinViaInviteLink(token);
}
