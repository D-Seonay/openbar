"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import * as api from "@/lib/api-client";
import { isAdminLoggedIn, getSession, SESSION_COOKIE } from "@/lib/session";
import type { BarcodeLookupResult, BottleType, BottleVolume, EventMedia } from "@/lib/types";
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
  // Present only when the bottle came in through a scan; the API normalises and
  // validates it, so an empty field is simply omitted.
  const barcode = String(formData.get("barcode") ?? "").trim() || undefined;

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

  try {
    await api.addBottle(barId, {
      name, type, quantity, vip, tags, notes, lowStockThreshold, volumes, imageUrl, barcode,
    });
  } catch (err) {
    // Most likely the barcode is already on another bottle of this bar; the
    // form shows the message rather than failing silently.
    return { error: err instanceof Error ? err.message : "Erreur lors de l'ajout." };
  }
  revalidatePath("/stock");
  revalidatePath("/cocktails");
  revalidatePath("/");
}

/**
 * Resolve a scanned barcode against this bar's stock, then the public product
 * database. Any member may scan; the API decides what they are allowed to see.
 */
export async function lookupBarcodeAction(
  barId: string,
  barcode: string,
): Promise<BarcodeLookupResult | { error: string }> {
  await requireLoggedIn();
  try {
    return await api.lookupBarcode(barId, barcode);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Recherche du code-barres impossible." };
  }
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

export async function addWishlistItemAction(slug: string, formData: FormData) {
  await requireLoggedIn();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return;

  await api.addWishlistItem(slug, label);
  revalidatePath(`/soirees/${slug}`);
}

export async function deleteWishlistItemAction(slug: string, id: string) {
  await requireLoggedIn();
  await api.deleteWishlistItem(slug, id);
  revalidatePath(`/soirees/${slug}`);
}

export async function assignWishlistItemAction(slug: string, itemId: string) {
  await requireLoggedIn();
  await api.assignWishlistItem(slug, itemId);
  revalidatePath(`/soirees/${slug}`);
}

export async function unassignWishlistItemAction(slug: string, itemId: string) {
  await requireLoggedIn();
  await api.unassignWishlistItem(slug, itemId);
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

const MAX_MEDIA_SIZE = 200 * 1024 * 1024;

export async function uploadEventMedia(slug: string, formData: FormData): Promise<EventMedia | null> {
  await requireLoggedIn();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return null;
  if (file.size > MAX_MEDIA_SIZE) {
    throw new Error(`Le fichier dépasse la limite de ${MAX_MEDIA_SIZE / 1024 / 1024} Mo`);
  }

  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  const apiFormData = new FormData();
  apiFormData.append("file", file);

  const res = await fetch(`${getBaseApiUrl()}/events/${slug}/media/upload`, {
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

  revalidatePath(`/soirees/${slug}`);
  return res.json() as Promise<EventMedia>;
}

export async function addEventMediaLinkAction(slug: string, formData: FormData) {
  await requireLoggedIn();
  const url = String(formData.get("url") ?? "").trim();
  if (!url) return;

  try {
    await api.addEventMediaLink(slug, url);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Impossible d'ajouter le lien." };
  }
  revalidatePath(`/soirees/${slug}`);
}

export async function deleteEventMediaAction(slug: string, id: string) {
  try {
    await requireLoggedIn();
    await api.deleteEventMedia(slug, id);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Erreur lors du retrait du média." };
  }
  revalidatePath(`/soirees/${slug}`);
}

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

// Avatars go through the same API endpoint as bottle images. Writing them into
// Next's `public/uploads` (the previous behaviour) doesn't survive a container
// rebuild and isn't reachable from the API origin the previews resolve against.
export async function uploadProfileImage(formData: FormData): Promise<string | null> {
  return uploadBottleImage(formData);
}

/**
 * Set or clear the photo of a bottle that already exists.
 *
 * Deliberately not routed through `updateBottleVolumes`, which recomputes
 * `quantity` from the volume list: a bottle with no volumes recorded would have
 * its stock silently reset to 0 just for gaining a picture. Patching `imageUrl`
 * alone also lets the API delete the file the bottle was pointing at before.
 */
export async function updateBottleImageAction(id: string, imageUrl: string) {
  await requireLoggedIn();
  try {
    await api.updateBottle(id, { imageUrl });
    revalidatePath("/stock");
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Mise à jour de la photo impossible." };
  }
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

