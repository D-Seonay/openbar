"use client";

import { useState, useTransition } from "react";
import { announceOnDiscordAction, createDiscordPollAction } from "@/app/actions";

/**
 * The host's two Discord actions on a soirée: announce it by DM, and open a
 * poll in the bar's channel.
 *
 * Both report what actually happened rather than a bare "sent". A bot can only
 * DM someone who shares a guild with it and has DMs open, so a partial result
 * is normal and the host needs to see it — otherwise they assume everyone was
 * reached.
 */
export default function DiscordActions({ slug, barId }: { slug: string; barId: string }) {
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<{ tone: "ok" | "ko"; text: string } | null>(null);

  const [pollOpen, setPollOpen] = useState(false);
  const [question, setQuestion] = useState("On se retrouve où ?");
  const [answers, setAnswers] = useState("Chez moi\nAu bar\nÀ voir");
  const [hours, setHours] = useState("24");

  const announce = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await announceOnDiscordAction(slug);
      if ("error" in res) {
        setFeedback({ tone: "ko", text: res.error });
        return;
      }
      const parts = [`${res.sent} invité${res.sent > 1 ? "s" : ""} prévenu${res.sent > 1 ? "s" : ""}`];
      if (res.failed > 0) parts.push(`${res.failed} injoignable${res.failed > 1 ? "s" : ""}`);
      if (res.unlinked > 0) parts.push(`${res.unlinked} sans Discord lié`);
      // Surfaced explicitly: left silent, the host would believe the whole bar
      // was reached and never press the button again.
      if (res.pending > 0) {
        parts.push(`${res.pending} pas encore prévenu${res.pending > 1 ? "s" : ""} — relance pour finir`);
      }
      setFeedback({ tone: res.sent > 0 ? "ok" : "ko", text: parts.join(" · ") });
    });
  };

  const sendPoll = () => {
    setFeedback(null);
    const options = answers
      .split("\n")
      .map((a) => a.trim())
      .filter(Boolean);
    startTransition(async () => {
      const res = await createDiscordPollAction(barId, question.trim(), options, Number(hours) || 24);
      if ("error" in res) {
        setFeedback({ tone: "ko", text: res.error });
        return;
      }
      if (res.posted) {
        setPollOpen(false);
        setFeedback({ tone: "ok", text: "Sondage publié dans le salon." });
      } else {
        setFeedback({ tone: "ko", text: res.reason ?? "Sondage non publié." });
      }
    });
  };

  const inputClass =
    "w-full bg-ink border border-white/[0.12] rounded-xl px-3 py-2 text-xs text-cream placeholder:text-muted/60 focus:outline-none focus:border-orange";

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-ink-2/80 p-5 sm:p-6 space-y-4 shadow-xl">
      <div className="flex items-center gap-2 border-b border-white/[0.08] pb-3">
        <span className="text-xl">🎮</span>
        <h2 className="font-display text-xl font-bold text-cream">Discord</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={announce}
          disabled={isPending}
          className="tap-target-sm flex items-center px-3.5 py-2 rounded-xl bg-[#5865F2] hover:bg-[#4752c4] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-60"
        >
          {isPending ? "…" : "📩 Annoncer en MP"}
        </button>
        <button
          onClick={() => setPollOpen((o) => !o)}
          className="tap-target-sm flex items-center px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.1] text-xs text-cream font-bold uppercase tracking-wider transition-colors cursor-pointer"
        >
          📊 {pollOpen ? "Fermer" : "Lancer un sondage"}
        </button>
      </div>

      {pollOpen && (
        <div className="space-y-2.5 p-4 rounded-xl bg-ink border border-white/[0.08]">
          <div>
            <label className="text-[10px] uppercase tracking-caps text-muted mb-1 block">Question</label>
            <input value={question} onChange={(e) => setQuestion(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-caps text-muted mb-1 block">
              Réponses — une par ligne, 2 à 10
            </label>
            <textarea
              value={answers}
              onChange={(e) => setAnswers(e.target.value)}
              rows={4}
              className={`${inputClass} resize-y`}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[10px] uppercase tracking-caps text-muted mb-1 block">Durée (heures)</label>
              <input
                type="number"
                min="1"
                max="768"
                inputMode="numeric"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className={`${inputClass} w-24`}
              />
            </div>
            <button
              onClick={sendPoll}
              disabled={isPending}
              className="tap-target-sm flex items-center px-4 py-2 rounded-xl bg-orange text-ink text-xs font-bold uppercase tracking-wider hover:bg-orange-hover transition-colors cursor-pointer disabled:opacity-60"
            >
              {isPending ? "…" : "Publier"}
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <p className={`text-[11px] ${feedback.tone === "ok" ? "text-emerald-400" : "text-red-400"}`}>
          {feedback.text}
        </p>
      )}

      <p className="text-[10px] text-muted/70 leading-relaxed">
        Le MP n&apos;atteint que les invités ayant lié leur Discord, partageant un
        serveur avec le bot et acceptant les messages privés.
      </p>
    </section>
  );
}
