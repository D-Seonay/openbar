"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlinkDiscordAction } from "./actions";
import type { MyProfile } from "@/lib/types";
import { Button } from "@/components/ui";

const MESSAGES: Record<string, { tone: "ok" | "ko"; text: string }> = {
  ok: { tone: "ok", text: "Compte Discord lié." },
  refus: { tone: "ko", text: "Tu as refusé l'autorisation sur Discord." },
  etat: {
    tone: "ko",
    text: "Lien de retour invalide ou expiré. Relance la liaison depuis cette page.",
  },
  "deja-lie": {
    tone: "ko",
    text: "Ce compte Discord est déjà lié à un autre profil OpenBar.",
  },
  erreur: { tone: "ko", text: "La liaison a échoué. Réessaie." },
};

export default function DiscordLink({
  profile,
  status,
  configured,
}: {
  profile: MyProfile;
  status?: string;
  /** False when the server has no Discord credentials set. */
  configured: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const message = status ? MESSAGES[status] : undefined;

  return (
    <section className="rounded-xl border border-rule bg-paper-sunk/40 p-5 space-y-3">
      <div>
        <h2 className="font-display text-[17px] text-ink">Compte Discord</h2>
        <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
          Une fois lié, le bot peut te retrouver sur Discord — pour t&apos;envoyer les
          soirées et savoir qui ramène quoi.
        </p>
      </div>

      {message && (
        <p className={`text-[13px] ${message.tone === "ok" ? "text-done" : "text-terracotta"}`}>
          {message.text}
        </p>
      )}

      {!configured && !profile.discordUserId ? (
        <p className="text-[13px] text-ink-soft/80 leading-relaxed">
          Discord n&apos;est pas configuré sur ce serveur. L&apos;hôte doit renseigner
          <span className="font-mono text-ink"> DISCORD_CLIENT_ID</span>,
          <span className="font-mono text-ink"> DISCORD_CLIENT_SECRET</span> et
          <span className="font-mono text-ink"> DISCORD_REDIRECT_URI</span>, puis
          recréer les conteneurs — un simple redémarrage ne recharge pas le fichier
          d&apos;environnement.
        </p>
      ) : profile.discordUserId ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 shrink-0 rounded-lg bg-[#5865F2]/15 border border-[#5865F2]/40 flex items-center justify-center text-[15px]">
              🎮
            </span>
            <span className="min-w-0">
              <span className="text-[13px] text-ink font-semibold block truncate">
                {profile.discordUsername ?? "Compte Discord"}
              </span>
              <span className="text-[13px] text-ink-soft font-mono">{profile.discordUserId}</span>
            </span>
          </span>
          <Button
            variant="danger"
            onClick={() =>
              startTransition(async () => {
                await unlinkDiscordAction();
                router.refresh();
              })
            }
            disabled={isPending}
            className="shrink-0"
          >
            {isPending ? "…" : "Délier"}
          </Button>
        </div>
      ) : (
        // A plain link, not fetch: the flow is a full redirect to Discord.
        <a
          href="/api/discord/start"
          className="tap-target inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-[13px] font-bold uppercase tracking-wider transition-colors"
        >
          🎮 Lier mon compte Discord
        </a>
      )}
    </section>
  );
}
