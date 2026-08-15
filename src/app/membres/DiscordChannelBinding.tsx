"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBarDiscordChannelAction } from "./actions";
import { Button } from "@/components/ui";

/**
 * Bind the bar to a Discord channel.
 *
 * Asks for the channel id rather than a name: names are ambiguous across
 * categories and change, whereas the id is stable. Copying it needs Developer
 * Mode on, which the hint spells out — otherwise this is the kind of field
 * people stare at.
 */
export default function DiscordChannelBinding({
  barId,
  channelId,
}: {
  barId: string;
  channelId: string | null;
}) {
  const [value, setValue] = useState(channelId ?? "");
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "ok" | "ko"; text: string } | null>(null);
  const router = useRouter();

  const save = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await setBarDiscordChannelAction(barId, value);
      if (res?.error) {
        setFeedback({ tone: "ko", text: res.error });
        return;
      }
      setFeedback({
        tone: "ok",
        text: value.trim() ? "Salon lié." : "Salon délié — plus rien n'est publié.",
      });
      router.refresh();
    });
  };

  return (
    <section className="rounded-xl border border-rule bg-paper-sunk/40 p-5 space-y-3">
      <div>
        <h2 className="font-display text-[17px] text-ink">Salon Discord</h2>
        <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
          Le tableau « à ramener » de chaque soirée y est publié, puis mis à jour à
          chaque changement. Laisse vide pour ne rien publier.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Identifiant du salon"
          inputMode="numeric"
          className="flex-1 min-w-0 min-h-[44px] bg-paper-sunk border border-rule rounded-xl px-3.5 py-2 text-[13px] text-ink placeholder:text-ink-soft focus:outline-none focus:border-terracotta font-mono"
        />
        <Button variant="principal" onClick={save} disabled={isPending} className="shrink-0">
          {isPending ? "…" : "Enregistrer"}
        </Button>
      </div>

      {feedback && (
        <p className={`text-[13px] ${feedback.tone === "ok" ? "text-done" : "text-terracotta"}`}>
          {feedback.text}
        </p>
      )}

      <p className="text-[13px] text-ink-soft leading-relaxed">
        Dans Discord : Paramètres → Avancés → Mode développeur, puis clic droit sur le
        salon → « Copier l&apos;identifiant ». Le bot doit pouvoir y écrire.
      </p>
    </section>
  );
}
