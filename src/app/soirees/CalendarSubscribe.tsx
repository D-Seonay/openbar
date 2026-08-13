"use client";

import { useState, useTransition } from "react";
import { calendarFeedPathAction } from "@/app/actions";

/**
 * The personal feed a phone can subscribe to.
 *
 * `webcal://` is what makes iOS and Google offer "subscribe" rather than a
 * one-off import: the same URL over https downloads a snapshot that never
 * updates, which is precisely what the issue asks to avoid.
 */
export default function CalendarSubscribe() {
  const [isPending, startTransition] = useTransition();
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reveal = (rotate: boolean) => {
    setError(null);
    setCopied(false);
    startTransition(async () => {
      const res = await calendarFeedPathAction(rotate);
      if (res.error) setError(res.error);
      else if (res.path) setPath(res.path);
    });
  };

  const httpsUrl = path ? `${window.location.origin}${path}` : "";
  const webcalUrl = httpsUrl.replace(/^https?:/, "webcal:");

  return (
    <section className="rounded-xl border border-white/[0.08] bg-ink-2/40 p-5 space-y-3">
      <div>
        <h2 className="font-display text-lg text-cream">Mon calendrier de soirées</h2>
        <p className="text-xs text-muted mt-1 leading-relaxed">
          Un abonnement qui se met à jour tout seul : les nouvelles soirées de tes bars
          apparaissent dans Google Agenda ou dans l&apos;app Calendrier de l&apos;iPhone.
        </p>
      </div>

      {!path ? (
        <button
          onClick={() => reveal(false)}
          disabled={isPending}
          className="tap-target-sm flex items-center gap-2 px-3.5 py-2 rounded-xl bg-orange/15 hover:bg-orange/25 border border-orange/40 text-xs text-orange font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-60"
        >
          {isPending ? "Génération…" : "🗓️ Obtenir mon lien d'abonnement"}
        </button>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            <a
              href={webcalUrl}
              className="tap-target-sm flex items-center px-3.5 py-2 rounded-xl bg-orange text-ink text-xs font-extrabold uppercase tracking-wider hover:bg-orange-hover transition-colors"
            >
              S&apos;abonner (iPhone / Mac)
            </a>
            <a
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpsUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tap-target-sm flex items-center px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs text-cream font-bold uppercase tracking-wider transition-colors"
            >
              Ajouter à Google Agenda
            </a>
            <button
              onClick={() => {
                void navigator.clipboard.writeText(httpsUrl).then(
                  () => setCopied(true),
                  () => setError("Le navigateur a refusé l'accès au presse-papiers."),
                );
              }}
              className="tap-target-sm flex items-center px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs text-cream font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              {copied ? "✓ Copié" : "Copier le lien"}
            </button>
          </div>

          <p className="text-[10px] text-muted font-mono break-all">{httpsUrl}</p>
          <p className="text-[10px] text-muted/70 leading-relaxed">
            Ce lien vaut mot de passe : qui l&apos;a peut voir tes soirées.{" "}
            <button
              onClick={() => reveal(true)}
              disabled={isPending}
              className="text-orange hover:underline cursor-pointer disabled:opacity-60"
            >
              Générer un nouveau lien
            </button>{" "}
            désactive l&apos;ancien.
          </p>
        </div>
      )}

      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </section>
  );
}
