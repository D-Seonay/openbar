"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { unlinkDiscordAction } from "./actions";
import type { MyProfile } from "@/lib/types";

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
    <section className="rounded-xl border border-white/[0.08] bg-ink-2/40 p-5 space-y-3">
      <div>
        <h2 className="font-display text-lg text-cream">Compte Discord</h2>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Une fois lié, le bot peut te retrouver sur Discord — pour t&apos;envoyer les
          soirées et savoir qui ramène quoi.
        </p>
      </div>

      {message && (
        <p
          className={`text-[11px] ${message.tone === "ok" ? "text-emerald-400" : "text-red-400"}`}
        >
          {message.text}
        </p>
      )}

      {!configured && !profile.discordUserId ? (
        <p className="text-[11px] text-muted/80 leading-relaxed">
          Discord n&apos;est pas configuré sur ce serveur. L&apos;hôte doit renseigner
          <span className="font-mono text-cream"> DISCORD_CLIENT_ID</span>,
          <span className="font-mono text-cream"> DISCORD_CLIENT_SECRET</span> et
          <span className="font-mono text-cream"> DISCORD_REDIRECT_URI</span>, puis
          recréer les conteneurs — un simple redémarrage ne recharge pas le fichier
          d&apos;environnement.
        </p>
      ) : profile.discordUserId ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 shrink-0 rounded-lg bg-[#5865F2]/15 border border-[#5865F2]/40 flex items-center justify-center text-sm">
              🎮
            </span>
            <span className="min-w-0">
              <span className="text-xs text-cream font-semibold block truncate">
                {profile.discordUsername ?? "Compte Discord"}
              </span>
              <span className="text-[10px] text-muted font-mono">{profile.discordUserId}</span>
            </span>
          </span>
          <button
            onClick={() =>
              startTransition(async () => {
                await unlinkDiscordAction();
                router.refresh();
              })
            }
            disabled={isPending}
            className="tap-target-sm shrink-0 flex items-center px-3 py-1.5 rounded-xl bg-white/[0.06] hover:bg-red-500/10 border border-white/[0.1] hover:border-red-400/40 text-[10px] text-muted hover:text-red-400 font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-60"
          >
            {isPending ? "…" : "Délier"}
          </button>
        </div>
      ) : (
        // A plain link, not fetch: the flow is a full redirect to Discord.
        <a
          href="/api/discord/start"
          className="tap-target-sm inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold uppercase tracking-wider transition-colors"
        >
          🎮 Lier mon compte Discord
        </a>
      )}
    </section>
  );
}
