"use client";

import { useState } from "react";
import { invalidateProfileCaches } from "@/app/lib/profileCache";
import { triggerAhaMicrocopy } from "@/app/lib/ahaMicrocopy";

type Choice = "yes" | "no";

export function DetailVoteButtons({
  questionId,
  initialChoice,
  closesAt,
}: {
  questionId: string;
  initialChoice: Choice | null;
  closesAt?: string | null;
}) {
  const [choice, setChoice] = useState<Choice | null>(initialChoice);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasChoice = choice === "yes" || choice === "no";

  const handleVote = async (nextChoice: Choice) => {
    if (choice || submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, choice: nextChoice }),
      });

      if (res.status === 429) {
        const data = (await res.json()) as { retryAfterMs?: number };
        const retry = Math.ceil(((data.retryAfterMs ?? 1000) as number) / 1000);
        setError(`Bitte warte ${retry} Sekunde(n), bevor du erneut votest.`);
        return;
      }

      if (!res.ok) {
        setError("Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut.");
        return;
      }

      invalidateProfileCaches();
      setChoice(nextChoice);
      triggerAhaMicrocopy({ closesAt: closesAt ?? null });
    } catch {
      setError("Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  };

  const votedLabel =
    choice === "yes" ? "Du hast Ja gestimmt" : choice === "no" ? "Du hast Nein gestimmt" : null;

  return (
    <div className="mt-8 space-y-3">
      <section className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          className={`card-button yes ${
            choice === "yes"
              ? "ring-2 ring-emerald-200/80 border-emerald-200/80 brightness-110 shadow-[0_0_0_2px_rgba(52,211,153,0.32),0_0_46px_rgba(52,211,153,0.62)]"
              : hasChoice
                ? "opacity-30 saturate-50"
                : "hover:shadow-[0_0_18px_rgba(52,211,153,0.25)]"
          } ${submitting ? "opacity-70 cursor-wait" : ""}`}
          onClick={() => handleVote("yes")}
          disabled={Boolean(choice) || submitting}
        >
          Ja
        </button>
        <button
          type="button"
          className={`card-button no ${
            choice === "no"
              ? "ring-2 ring-rose-200/80 border-rose-200/80 brightness-110 shadow-[0_0_0_2px_rgba(248,113,113,0.32),0_0_46px_rgba(248,113,113,0.62)]"
              : hasChoice
                ? "opacity-30 saturate-50"
                : "hover:shadow-[0_0_18px_rgba(248,113,113,0.25)]"
          } ${submitting ? "opacity-70 cursor-wait" : ""}`}
          onClick={() => handleVote("no")}
          disabled={Boolean(choice) || submitting}
        >
          Nein
        </button>
      </section>
      {votedLabel && (
        <p className="text-xs font-semibold text-emerald-200">{votedLabel}</p>
      )}
      {error && <p className="text-xs text-rose-200">{error}</p>}
    </div>
  );
}
