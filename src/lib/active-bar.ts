import { cookies } from "next/headers";
import type { Bar } from "./types";

export const ACTIVE_BAR_COOKIE = "bardenoa_active_bar";

export async function resolveActiveBar(bars: Bar[]): Promise<Bar | null> {
  if (bars.length === 0) return null;

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_BAR_COOKIE)?.value;
  const active = bars.find((bar) => bar.id === activeId);
  if (active) return active;

  return bars.find((bar) => bar.myRole === "OWNER") ?? bars[0];
}
