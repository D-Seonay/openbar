"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { setBarDiscordChannel } from "@/lib/api-client";

export async function setBarDiscordChannelAction(barId: string, channelId: string) {
  const session = await getSession();
  if (!session) redirect("/login");
  try {
    await setBarDiscordChannel(barId, channelId);
    revalidatePath("/membres");
    return { success: true };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Impossible de lier le salon." };
  }
}
