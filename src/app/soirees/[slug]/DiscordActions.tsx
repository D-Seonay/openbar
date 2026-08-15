"use client";

import { useState, useTransition } from "react";
import { announceOnDiscordAction, createDiscordPollAction } from "@/app/actions";
import { Button, Field, champClasses } from "@/components/ui";

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

  return (
    <section className="rounded-xl bg-paper border border-rule p-4 space-y-4">
      <h2 className="font-display text-[17px] text-ink">Discord</h2>

      <div className="flex flex-wrap gap-2">
        <Button onClick={announce} disabled={isPending} variant="discret">
          {isPending ? "…" : "📩 Annoncer en MP"}
        </Button>
        <Button onClick={() => setPollOpen((o) => !o)} variant="discret">
          📊 {pollOpen ? "Fermer" : "Lancer un sondage"}
        </Button>
      </div>

      {pollOpen && (
        <div className="space-y-1 p-4 rounded-xl bg-paper-sunk border border-rule">
          <Field label="Question" htmlFor="poll-question">
            <input
              id="poll-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className={champClasses}
            />
          </Field>
          <Field label="Réponses — une par ligne, 2 à 10" htmlFor="poll-answers">
            <textarea
              id="poll-answers"
              value={answers}
              onChange={(e) => setAnswers(e.target.value)}
              rows={4}
              className={`${champClasses} h-auto py-2 resize-y`}
            />
          </Field>
          <div className="flex flex-wrap items-end gap-2">
            <Field label="Durée (heures)" htmlFor="poll-hours">
              <input
                id="poll-hours"
                type="number"
                min="1"
                max="768"
                inputMode="numeric"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                className={`w-24 ${champClasses}`}
              />
            </Field>
            <Button onClick={sendPoll} disabled={isPending} className="mb-4">
              {isPending ? "…" : "Publier"}
            </Button>
          </div>
        </div>
      )}

      {feedback && (
        <p className={`text-[13px] ${feedback.tone === "ok" ? "text-done" : "text-terracotta"}`}>
          {feedback.text}
        </p>
      )}

      <p className="text-[13px] text-ink-soft leading-relaxed">
        Le MP n&apos;atteint que les invités ayant lié leur Discord, partageant un
        serveur avec le bot et acceptant les messages privés.
      </p>
    </section>
  );
}
