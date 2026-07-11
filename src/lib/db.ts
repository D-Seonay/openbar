import { promises as fs } from "fs";
import path from "path";
import type { Bottle, EventItem, Contribution, StockAdjustment } from "./types";

// Internal store type for JSON persistence (separate from exported types)
interface StoreData {
  bottles: Bottle[];
  events: (EventItem & { vipNames?: string[] })[];
  contributions: (Contribution & { eventSlug?: string; guestName?: string })[];
  stockAdjustments: (StockAdjustment & { eventSlug?: string })[];
}

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "store.json");

const empty: StoreData = { bottles: [], events: [], contributions: [], stockAdjustments: [] };

// Simple write queue so concurrent server actions don't corrupt the file.
let queue: Promise<unknown> = Promise.resolve();

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(DATA_FILE);
  } catch {
    await fs.writeFile(DATA_FILE, JSON.stringify(empty, null, 2), "utf-8");
  }
}

async function readStore(): Promise<StoreData> {
  await ensureFile();
  const raw = await fs.readFile(DATA_FILE, "utf-8");
  try {
    const parsed = JSON.parse(raw) as StoreData;
    return {
      bottles: parsed.bottles ?? [],
      events: parsed.events ?? [],
      contributions: parsed.contributions ?? [],
      stockAdjustments: parsed.stockAdjustments ?? [],
    };
  } catch {
    return { ...empty };
  }
}

async function writeStore(store: StoreData) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf-8");
}

function mutate<T>(fn: (store: StoreData) => Promise<T> | T): Promise<T> {
  const run = queue.then(async () => {
    const store = await readStore();
    const result = await fn(store);
    await writeStore(store);
    return result;
  });
  // Keep the chain alive even if this particular mutation throws.
  queue = run.catch(() => undefined);
  return run;
}

function makeId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "soiree"
  );
}

// ---------- Bottles ----------

export async function listBottles(): Promise<Bottle[]> {
  const store = await readStore();
  return store.bottles.sort((a, b) => a.name.localeCompare(b.name));
}

export async function addBottle(input: Omit<Bottle, "id" | "createdAt">) {
  return mutate((store) => {
    const bottle: Bottle = {
      ...input,
      id: makeId(),
      createdAt: new Date().toISOString(),
    };
    store.bottles.push(bottle);
    return bottle;
  });
}

export async function updateBottle(id: string, input: Partial<Omit<Bottle, "id" | "createdAt">>) {
  return mutate((store) => {
    const bottle = store.bottles.find((b) => b.id === id);
    if (!bottle) return null;
    Object.assign(bottle, input);
    return bottle;
  });
}

export async function deleteBottle(id: string) {
  return mutate((store) => {
    store.bottles = store.bottles.filter((b) => b.id !== id);
    return true;
  });
}

// ---------- Events ----------

export async function listEvents(): Promise<EventItem[]> {
  const store = await readStore();
  return store.events.sort((a, b) => a.date.localeCompare(b.date));
}

export async function getEvent(slug: string): Promise<EventItem | null> {
  const store = await readStore();
  return store.events.find((e) => e.slug === slug) ?? null;
}

export async function createEvent(input: { name: string; date: string; vipNames?: string[] }) {
  return mutate((store) => {
    const base = slugify(input.name);
    let slug = base;
    let n = 1;
    while (store.events.some((e) => e.slug === slug)) {
      n += 1;
      slug = `${base}-${n}`;
    }
    const event: EventItem & { vipNames?: string[] } = {
      id: makeId(),
      slug,
      name: input.name,
      date: input.date,
      vipNames: input.vipNames?.map((v) => v.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
    };
    store.events.push(event);
    return { id: event.id, slug: event.slug, name: event.name, date: event.date, createdAt: event.createdAt };
  });
}

export async function deleteEvent(slug: string) {
  return mutate((store) => {
    store.events = store.events.filter((e) => e.slug !== slug);
    store.contributions = store.contributions.filter((c) => (c as any).eventSlug !== slug && (c as any).eventId !== slug);
    store.stockAdjustments = store.stockAdjustments.filter((a) => (a as any).eventSlug !== slug && (a as any).eventId !== slug);
    return true;
  });
}

// ---------- Contributions ----------

export async function listContributions(slug: string): Promise<Contribution[]> {
  const store = await readStore();
  return store.contributions
    .filter((c) => (c as any).eventSlug === slug || (c as any).eventId === slug)
    .map((c) => {
      const { eventSlug, guestName, ...rest } = c as any;
      return rest as Contribution;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function addContribution(
  input: Omit<Contribution, "id" | "createdAt"> | { eventSlug: string; guestName: string; item: string; quantity?: string }
) {
  return mutate((store) => {
    // Handle both new format (eventId/user) and legacy format (eventSlug/guestName)
    const isLegacy = "eventSlug" in input;
    const eventId = isLegacy ? (input as any).eventSlug : (input as any).eventId;
    const user = isLegacy
      ? { id: "legacy", username: (input as any).guestName }
      : (input as any).user;

    const contribution: Contribution & { eventSlug?: string; guestName?: string } = {
      id: makeId(),
      eventId,
      eventSlug: eventId, // For backwards compat in JSON
      user,
      guestName: user.username, // For backwards compat in JSON
      item: (input as any).item,
      quantity: (input as any).quantity,
      createdAt: new Date().toISOString(),
    };
    store.contributions.push(contribution);
    const { eventSlug, guestName, ...result } = contribution;
    return result as Contribution;
  });
}

export async function deleteContribution(id: string) {
  return mutate((store) => {
    store.contributions = store.contributions.filter((c) => c.id !== id);
    return true;
  });
}

export function isVipGuest(event: EventItem & { vipNames?: string[] }, guestName: string) {
  const normalized = guestName.trim().toLowerCase();
  return (event.vipNames ?? []).some((v) => v.toLowerCase() === normalized);
}

// ---------- Stock adjustments ----------

export async function listStockAdjustments(eventId: string): Promise<StockAdjustment[]> {
  const store = await readStore();
  return store.stockAdjustments
    .filter((a) => (a as any).eventSlug === eventId || (a as any).eventId === eventId)
    .map((a) => {
      const { eventSlug, ...rest } = a as any;
      return rest as StockAdjustment;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function applyStockAdjustments(
  eventId: string,
  changes: { bottleId: string; quantityAfter: number }[]
): Promise<StockAdjustment[]> {
  return mutate((store) => {
    const created: StockAdjustment[] = [];
    for (const change of changes) {
      const bottle = store.bottles.find((b) => b.id === change.bottleId);
      if (!bottle) continue;
      const quantityBefore = bottle.quantity;
      const quantityAfter = Math.max(0, change.quantityAfter);
      if (quantityBefore === quantityAfter) continue;

      const diff = quantityBefore - quantityAfter;
      bottle.quantity = quantityAfter;

      // Keep volumes array in sync if it exists
      if (bottle.volumes && bottle.volumes.length > 0) {
        if (diff > 0) {
          let toRemove = diff;
          for (let i = bottle.volumes.length - 1; i >= 0 && toRemove > 0; i--) {
            const vol = bottle.volumes[i];
            const removeHere = Math.min(vol.quantity, toRemove);
            vol.quantity -= removeHere;
            toRemove -= removeHere;
          }
          bottle.volumes = bottle.volumes.filter((v) => v.quantity > 0);
        } else if (diff < 0) {
          const added = Math.abs(diff);
          bottle.volumes[0].quantity += added;
        }
      }

      const adjustment: StockAdjustment & { eventSlug?: string } = {
        id: makeId(),
        eventId,
        eventSlug: eventId, // For backwards compat in JSON
        bottleId: bottle.id,
        bottleName: bottle.name,
        quantityBefore,
        quantityAfter,
        createdAt: new Date().toISOString(),
      };
      store.stockAdjustments.push(adjustment);
      const { eventSlug, ...result } = adjustment;
      created.push(result as StockAdjustment);
    }
    return created;
  });
}
