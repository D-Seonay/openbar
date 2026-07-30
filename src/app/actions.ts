"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import * as api from "@/lib/api-client";
import { isAdminLoggedIn, getSession, SESSION_COOKIE } from "@/lib/session";
import type { BottleType, BottleVolume } from "@/lib/types";
import { getBaseApiUrl } from "@/lib/api";

async function requireAdmin() {
  if (!(await isAdminLoggedIn())) {
    redirect("/login");
  }
}

async function requireVipOrAdmin() {
  const session = await getSession();
  if (!session || !(session.vip || session.role === "ADMIN")) {
    redirect("/login");
  }
}

async function requireLoggedIn() {
  const session = await getSession();
  if (!session) redirect("/login");
}

async function requireBarOwnerOrAdmin(barId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") return;

  const bars = await api.listMyBars();
  const isOwner = bars.some((bar) => bar.id === barId && bar.myRole === "OWNER");
  if (!isOwner) redirect("/");
}

async function requireBarVipOrAdmin(barId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") return;

  const bars = await api.listMyBars();
  const bar = bars.find((b) => b.id === barId);
  if (!bar || !bar.myVip) redirect("/");
}

function parseTags(raw: FormDataEntryValue | null): string[] {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export async function createBottle(barId: string, formData: FormData) {
  await requireBarOwnerOrAdmin(barId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const type = String(formData.get("type") ?? "autre") as BottleType;
  const vip = formData.get("vip") === "on";
  const tags = parseTags(formData.get("tags"));
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const thresholdRaw = String(formData.get("lowStockThreshold") ?? "").trim();
  const lowStockThreshold = thresholdRaw ? Number(thresholdRaw) : undefined;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || undefined;

  const volumesRaw = String(formData.get("volumes") ?? "").trim();
  let volumes: BottleVolume[] = [];
  let quantity = Number(formData.get("quantity") ?? 0) || 0;

  if (volumesRaw) {
    try {
      volumes = JSON.parse(volumesRaw) as BottleVolume[];
      quantity = volumes.reduce((sum, v) => sum + v.quantity, 0);
    } catch {
      // fallback to basic quantity
    }
  }

  await api.addBottle(barId, { name, type, quantity, vip, tags, notes, lowStockThreshold, volumes, imageUrl });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath("/");
}

export async function updateBottleQuantity(id: string, quantity: number) {
  await requireLoggedIn();
  await api.updateBottle(id, { quantity: Math.max(0, quantity) });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath("/");
}

export async function updateBottleVolumes(id: string, volumes: BottleVolume[], imageUrl?: string) {
  await requireLoggedIn();
  const quantity = volumes.reduce((sum, v) => sum + v.quantity, 0);
  await api.updateBottle(id, { volumes, quantity, imageUrl });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
}

export async function updateBottleThreshold(id: string, threshold: number | null) {
  await requireLoggedIn();
  await api.updateBottle(id, { lowStockThreshold: threshold ?? undefined });
  revalidatePath("/stock");
  revalidatePath("/");
}

export async function deleteBottleAction(id: string) {
  try {
    await requireLoggedIn();
    await api.deleteBottle(id);
    revalidatePath("/stock");
    revalidatePath("/cocktails");
    revalidatePath("/");
  } catch (err: any) {
    return { error: err.message || "Erreur lors de la suppression de la bouteille." };
  }
}

function parseJsonStringArray(raw: FormDataEntryValue | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string" && v.trim() !== "") : [];
  } catch {
    return [];
  }
}

function parseRecipeFormData(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const glass = String(formData.get("glass") ?? "").trim();
  const prepTime = String(formData.get("prepTime") ?? "").trim();
  const difficulty = String(formData.get("difficulty") ?? "Moyen") as "Facile" | "Moyen" | "Expert";
  const description = String(formData.get("description") ?? "").trim();
  const vip = formData.get("vip") === "on";
  const tags = formData.getAll("tags").map((t) => String(t));
  const ingredientsList = parseJsonStringArray(formData.get("ingredientsList"));
  const instructions = parseJsonStringArray(formData.get("instructions"));

  return { name, glass, prepTime, difficulty, description, vip, tags, ingredientsList, instructions };
}

export async function createRecipe(barId: string, formData: FormData) {
  await requireBarVipOrAdmin(barId);
  const input = parseRecipeFormData(formData);
  if (!input.name || input.tags.length === 0 || input.ingredientsList.length === 0 || input.instructions.length === 0) {
    return;
  }
  await api.createRecipe(barId, input);
  revalidatePath("/cocktails");
}

export async function updateRecipe(id: string, formData: FormData) {
  await requireVipOrAdmin();
  const input = parseRecipeFormData(formData);
  if (!input.name || input.tags.length === 0 || input.ingredientsList.length === 0 || input.instructions.length === 0) {
    return;
  }
  await api.updateRecipe(id, input);
  revalidatePath("/cocktails");
}

export async function deleteRecipeAction(id: string) {
  await requireVipOrAdmin();
  await api.deleteRecipe(id);
  revalidatePath("/cocktails");
}

export async function createEvent(barId: string, formData: FormData) {
  await requireBarOwnerOrAdmin(barId);
  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  if (!name || !date) return;

  const event = await api.createEvent(barId, { name, date });
  revalidatePath("/soirees");
  redirect(`/soirees/${event.slug}`);
}

export async function deleteEventAction(slug: string) {
  await requireLoggedIn();
  await api.deleteEvent(slug);
  revalidatePath("/soirees");
}

export async function addContribution(slug: string, formData: FormData) {
  const item = String(formData.get("item") ?? "").trim();
  const quantity = String(formData.get("quantity") ?? "").trim() || undefined;
  if (!item) return;

  await api.addContribution(slug, { item, quantity });
  revalidatePath(`/soirees/${slug}`);
}

export async function deleteContributionAction(slug: string, id: string) {
  await api.deleteContribution(slug, id);
  revalidatePath(`/soirees/${slug}`);
}

export async function submitBilan(slug: string, formData: FormData) {
  await requireLoggedIn();
  const changes: { bottleId: string; quantityAfter: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("quantity-")) continue;
    const bottleId = key.slice("quantity-".length);
    const quantityAfter = Number(value);
    if (Number.isNaN(quantityAfter)) continue;
    changes.push({ bottleId, quantityAfter });
  }

  await api.applyStockAdjustments(slug, changes);
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath(`/soirees/${slug}`);
  revalidatePath("/");
  redirect(`/soirees/${slug}`);
}

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;

export async function uploadBottleImage(formData: FormData): Promise<string | null> {
  await requireLoggedIn();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return null;
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`L'image dépasse la limite de ${MAX_IMAGE_SIZE / 1024 / 1024} Mo`);
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  const apiFormData = new FormData();
  apiFormData.append("file", file);

  const res = await fetch(`${getBaseApiUrl()}/bottles/upload`, {
    method: "POST",
    headers: {
      ...(token ? { Cookie: `${SESSION_COOKIE}=${token}` } : {}),
    },
    body: apiFormData,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(body.message ?? `Erreur API (${res.status})`);
  }

  const data = await res.json();
  return (data as { imageUrl: string }).imageUrl ?? null;
}

export async function uploadProfileImage(formData: FormData): Promise<string | null> {
  await requireLoggedIn();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return null;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "png";
  const filename = `avatar-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = path.join(uploadsDir, filename);

  await fs.writeFile(filePath, buffer);
  return `/uploads/${filename}`;
}

export async function editBottleAction(id: string, data: { name: string; type: BottleType; notes?: string; vip: boolean }) {
  await requireLoggedIn();
  try {
    await api.updateBottle(id, data);
    revalidatePath("/stock");
    revalidatePath("/");
    return { success: true };
  } catch (error: any) {
    return { error: error.message };
  }
}

