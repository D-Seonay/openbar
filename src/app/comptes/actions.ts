"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as api from "@/lib/api-client";
import { isAdminLoggedIn } from "@/lib/session";

async function requireAdmin() {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }
}

function randomTempPassword(): string {
  return Math.random().toString(36).slice(2, 10);
}

export async function createUserAction(formData: FormData) {
  await requireAdmin();
  const username = String(formData.get("username") ?? "").trim();
  if (!username) return;
  const vip = formData.get("vip") === "on";
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "USER";
  const password = randomTempPassword();

  await api.createUser({ username, password, role, vip });
  revalidatePath("/comptes");
  return { username, password };
}

export async function toggleRoleAction(id: string, role: "ADMIN" | "USER") {
  await requireAdmin();
  await api.updateUser(id, { role });
  revalidatePath("/comptes");
}

export async function toggleVipAction(id: string, vip: boolean) {
  await requireAdmin();
  await api.updateUser(id, { vip });
  revalidatePath("/comptes");
}

export async function resetPasswordAction(id: string): Promise<string> {
  await requireAdmin();
  const password = randomTempPassword();
  await api.updateUser(id, { password });
  revalidatePath("/comptes");
  return password;
}

export async function deleteUserAction(id: string): Promise<{ error?: string }> {
  await requireAdmin();
  try {
    await api.deleteUser(id);
    revalidatePath("/comptes");
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lors de la suppression" };
  }
}
