"use server";

import fs from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import * as db from "@/lib/db";
import type { BottleType, BottleVolume } from "@/lib/types";

function parseTags(raw: FormDataEntryValue | null): string[] {
  if (!raw) return [];
  return String(raw)
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

export async function createBottle(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const type = String(formData.get("type") ?? "autre") as BottleType;
  const vip = formData.get("vip") === "on";
  const tags = parseTags(formData.get("tags"));
  const notes = String(formData.get("notes") ?? "").trim() || undefined;
  const thresholdRaw = String(formData.get("lowStockThreshold") ?? "").trim();
  const lowStockThreshold = thresholdRaw ? Number(thresholdRaw) : undefined;
  const imageUrl = String(formData.get("imageUrl") ?? "").trim() || undefined;

  // Parse volumes list from hidden input
  const volumesRaw = String(formData.get("volumes") ?? "").trim();
  let volumes: BottleVolume[] = [];
  let quantity = Number(formData.get("quantity") ?? 0) || 0;

  if (volumesRaw) {
    try {
      volumes = JSON.parse(volumesRaw) as BottleVolume[];
      // If volumes are specified, set quantity as the sum of bottle quantities
      quantity = volumes.reduce((sum, v) => sum + v.quantity, 0);
    } catch {
      // fallback to basic quantity
    }
  }

  await db.addBottle({ name, type, quantity, vip, tags, notes, lowStockThreshold, volumes, imageUrl });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
}

export async function updateBottleQuantity(id: string, quantity: number) {
  await db.updateBottle(id, { quantity: Math.max(0, quantity) });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
}

export async function updateBottleVolumes(id: string, volumes: BottleVolume[], imageUrl?: string) {
  const quantity = volumes.reduce((sum, v) => sum + v.quantity, 0);
  await db.updateBottle(id, { volumes, quantity, imageUrl });
  revalidatePath("/stock");
  revalidatePath("/cocktails");
}

export async function updateBottleThreshold(id: string, threshold: number | null) {
  await db.updateBottle(id, { lowStockThreshold: threshold ?? undefined });
  revalidatePath("/stock");
  revalidatePath("/");
}

export async function deleteBottleAction(id: string) {
  await db.deleteBottle(id);
  revalidatePath("/stock");
  revalidatePath("/cocktails");
}

export async function createEvent(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const date = String(formData.get("date") ?? "");
  const vipNamesRaw = String(formData.get("vipNames") ?? "");
  const vipNames = vipNamesRaw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  if (!name || !date) return;

  const event = await db.createEvent({ name, date, vipNames });
  revalidatePath("/soirees");
  redirect(`/soirees/${event.slug}`);
}

export async function deleteEventAction(slug: string) {
  await db.deleteEvent(slug);
  revalidatePath("/soirees");
}

export async function addContribution(slug: string, formData: FormData) {
  const guestName = String(formData.get("guestName") ?? "").trim();
  const item = String(formData.get("item") ?? "").trim();
  const quantity = String(formData.get("quantity") ?? "").trim() || undefined;
  if (!guestName || !item) return;

  await db.addContribution({ eventSlug: slug, guestName, item, quantity });
  revalidatePath(`/soirees/${slug}`);
}

export async function deleteContributionAction(slug: string, id: string) {
  await db.deleteContribution(id);
  revalidatePath(`/soirees/${slug}`);
}

export async function submitBilan(slug: string, formData: FormData) {
  const changes: { bottleId: string; quantityAfter: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("quantity-")) continue;
    const bottleId = key.slice("quantity-".length);
    const quantityAfter = Number(value);
    if (Number.isNaN(quantityAfter)) continue;
    changes.push({ bottleId, quantityAfter });
  }

  await db.applyStockAdjustments(slug, changes);
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath(`/soirees/${slug}`);
  redirect(`/soirees/${slug}`);
}

export async function uploadBottleImage(formData: FormData): Promise<string | null> {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return null;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const ext = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "png";
  const filename = `bottle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const filePath = path.join(uploadsDir, filename);

  await fs.writeFile(filePath, buffer);
  return `/uploads/${filename}`;
}
