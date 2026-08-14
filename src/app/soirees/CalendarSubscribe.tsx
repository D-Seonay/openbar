"use client";

import { useState, useTransition } from "react";
import { calendarFeedPathAction } from "@/app/actions";
import { Button, Card } from "@/components/ui";

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
    <Card className="space-y-3">
      <div>
        <h2 className="font-display text-[17px] text-ink">Mon calendrier de soirées</h2>
        <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
          Un abonnement qui se met à jour tout seul : les nouvelles soirées de tes bars
          apparaissent dans Google Agenda ou dans l&apos;app Calendrier de l&apos;iPhone.
        </p>
      </div>

      {!path ? (
        <Button variant="discret" onClick={() => reveal(false)} disabled={isPending}>
          {isPending ? "Génération…" : "🗓️ Obtenir mon lien d'abonnement"}
        </Button>
      ) : (
        <div className="space-y-2.5">
          <div className="flex flex-wrap gap-2">
            <a
              href={webcalUrl}
              className="tap-target inline-flex items-center px-3.5 rounded-lg bg-terracotta text-paper text-[13px] font-semibold hover:bg-terracotta/90 transition-colors"
            >
              S&apos;abonner (iPhone / Mac)
            </a>
            <a
              href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(httpsUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="tap-target inline-flex items-center px-3.5 rounded-lg border border-rule text-ink text-[13px] font-semibold hover:bg-paper-sunk transition-colors"
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
              className="tap-target inline-flex items-center px-3.5 rounded-lg border border-rule text-ink text-[13px] font-semibold hover:bg-paper-sunk transition-colors cursor-pointer"
            >
              {copied ? "✓ Copié" : "Copier le lien"}
            </button>
          </div>

          <p className="text-[13px] text-ink-soft break-all">{httpsUrl}</p>
          <p className="text-[13px] text-ink-soft leading-relaxed">
            Ce lien vaut mot de passe : qui l&apos;a peut voir tes soirées.{" "}
            <button
              onClick={() => reveal(true)}
              disabled={isPending}
              className="text-terracotta hover:underline cursor-pointer disabled:opacity-60"
            >
              Générer un nouveau lien
            </button>{" "}
            désactive l&apos;ancien.
          </p>
        </div>
      )}

      {error && (
        <p className="text-[13px] text-terracotta" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}
