"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { invalidateProfileCaches } from "@/app/lib/profileCache";
import { triggerAhaMicrocopy } from "@/app/lib/ahaMicrocopy";
import type { PollOption } from "@/app/data/mock";

type Choice = "yes" | "no";

export function DetailVoteButtons({
  questionId,
  initialChoice,
  initialOptionId,
  answerMode,
  options,
  closesAt,
  className,
}: {
  questionId: string;
  initialChoice: Choice | null;
  initialOptionId?: string | null;
  answerMode?: "binary" | "options";
  options?: PollOption[] | null;
  closesAt?: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(initialChoice);
  const [optionId, setOptionId] = useState<string | null>(initialOptionId ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasChoice = choice === "yes" || choice === "no";
  const hasOption = typeof optionId === "string" && optionId.length > 0;
  const effectiveAnswerMode = answerMode === "options" ? "options" : "binary";

  const handleVoteBinary = async (nextChoice: Choice) => {
    if (choice || submitting || effectiveAnswerMode !== "binary") return;
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
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || "Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut.");
        return;
      }

      invalidateProfileCaches();
      setChoice(nextChoice);
      triggerAhaMicrocopy({ closesAt: closesAt ?? null });
      router.refresh();
    } catch {
      setError("Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoteOption = async (nextOptionId: string) => {
    if (hasOption || submitting || effectiveAnswerMode !== "options") return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, optionId: nextOptionId }),
      });

      if (res.status === 429) {
        const data = (await res.json()) as { retryAfterMs?: number };
        const retry = Math.ceil(((data.retryAfterMs ?? 1000) as number) / 1000);
        setError(`Bitte warte ${retry} Sekunde(n), bevor du erneut votest.`);
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error || "Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut.");
        return;
      }

      invalidateProfileCaches();
      setOptionId(nextOptionId);
      triggerAhaMicrocopy({ closesAt: closesAt ?? null });
      router.refresh();
    } catch {
      setError("Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut.");
    } finally {
      setSubmitting(false);
    }
  };

  const votedLabel =
    choice === "yes" ? "Du hast Ja gestimmt" : choice === "no" ? "Du hast Nein gestimmt" : null;

  const votedOptionLabel =
    effectiveAnswerMode === "options" && hasOption
      ? (() => {
          const label = (options ?? []).find((o) => o.id === optionId)?.label;
          return label ? `Du hast "${label}" gewählt` : "Du hast abgestimmt";
        })()
      : null;

  return (
    <div className={className ?? "mt-8 space-y-3"}>
      {effectiveAnswerMode === "binary" ? (
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
            onClick={() => handleVoteBinary("yes")}
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
            onClick={() => handleVoteBinary("no")}
            disabled={Boolean(choice) || submitting}
          >
            Nein
          </button>
        </section>
      ) : (
        <section className="grid gap-3">
          {(options ?? []).map((opt) => {
            const isSelected = opt.id === optionId;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => handleVoteOption(opt.id)}
                disabled={submitting || hasOption}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition ${
                  isSelected
                    ? "border-emerald-200/70 bg-emerald-500/20 text-white shadow-[0_0_0_2px_rgba(52,211,153,0.20)]"
                    : hasOption
                      ? "border-white/10 bg-white/5 text-slate-200 opacity-40"
                      : "border-white/10 bg-white/5 text-white hover:-translate-y-0.5 hover:border-emerald-200/40"
                } ${submitting ? "opacity-70 cursor-wait" : ""}`}
              >
                {opt.label}
              </button>
            );
          })}
        </section>
      )}

      {votedLabel ? <p className="text-xs font-semibold text-emerald-200">{votedLabel}</p> : null}
      {votedOptionLabel ? <p className="text-xs font-semibold text-emerald-200">{votedOptionLabel}</p> : null}
      {error && <p className="text-xs text-rose-200">{error}</p>}
    </div>
  );
}
