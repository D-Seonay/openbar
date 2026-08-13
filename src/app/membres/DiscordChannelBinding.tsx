"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setBarDiscordChannelAction } from "./actions";

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
    <section className="rounded-xl border border-white/[0.08] bg-ink-2/40 p-5 space-y-3">
      <div>
        <h2 className="font-display text-lg text-cream">Salon Discord</h2>
        <p className="text-xs text-muted mt-1 leading-relaxed">
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
          className="flex-1 min-w-0 bg-ink border border-white/[0.12] rounded-xl px-3.5 py-2 text-xs text-cream placeholder:text-muted/60 focus:outline-none focus:border-orange font-mono"
        />
        <button
          onClick={save}
          disabled={isPending}
          className="tap-target-sm shrink-0 flex items-center px-4 py-2 rounded-xl bg-orange text-ink text-xs font-bold uppercase tracking-wider hover:bg-orange-hover transition-colors cursor-pointer disabled:opacity-60"
        >
          {isPending ? "…" : "Enregistrer"}
        </button>
      </div>

      {feedback && (
        <p className={`text-[11px] ${feedback.tone === "ok" ? "text-emerald-400" : "text-red-400"}`}>
          {feedback.text}
        </p>
      )}

      <p className="text-[10px] text-muted/70 leading-relaxed">
        Dans Discord : Paramètres → Avancés → Mode développeur, puis clic droit sur le
        salon → « Copier l&apos;identifiant ». Le bot doit pouvoir y écrire.
      </p>
    </section>
  );
}
