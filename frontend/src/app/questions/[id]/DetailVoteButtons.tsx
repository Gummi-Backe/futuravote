"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { invalidateProfileCaches } from "@/app/lib/profileCache";
import { triggerAhaMicrocopy } from "@/app/lib/ahaMicrocopy";
import { trackEvent } from "@/app/lib/analytics";
import { recordFeedVoteDelta } from "@/app/lib/feedVoteSync";
import {
  clearVoteCooldown,
  FV_VOTE_COOLDOWN_DEFAULT_MS,
  getVoteCooldownRemainingSeconds,
  setVoteCooldownUntil,
} from "@/app/lib/voteCooldown";
import type { PollOption } from "@/app/data/mock";

type Choice = "yes" | "no";

type VoteResponse = {
  alreadyVoted?: boolean;
  question?: {
    userChoice?: unknown;
    userOptionId?: unknown;
  };
};

export function DetailVoteButtons({
  questionId,
  initialChoice,
  initialOptionId,
  answerMode,
  options,
  closesAt,
  questionTitle,
  shareUrl,
  className,
}: {
  questionId: string;
  initialChoice: Choice | null;
  initialOptionId?: string | null;
  answerMode?: "binary" | "options";
  options?: PollOption[] | null;
  closesAt?: string | null;
  questionTitle: string;
  shareUrl?: string;
  className?: string;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<Choice | null>(initialChoice);
  const [optionId, setOptionId] = useState<string | null>(initialOptionId ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasChoice = choice === "yes" || choice === "no";
  const hasOption = typeof optionId === "string" && optionId.length > 0;
  const effectiveAnswerMode = answerMode === "options" ? "options" : "binary";

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const showToast = (message: string, type: "success" | "error") => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 2500);
  };

  const handleVoteBinary = async (nextChoice: Choice) => {
    if (choice || submitting || effectiveAnswerMode !== "binary") return;
    const cooldownSeconds = getVoteCooldownRemainingSeconds();
    if (cooldownSeconds > 0) {
      setError(`Bitte warte ${cooldownSeconds} Sekunde(n), bevor du erneut votest.`);
      showToast(`Bitte warte ${cooldownSeconds} Sekunde(n), bevor du erneut votest.`, "error");
      return;
    }
    const prevChoice = choice;
    trackEvent("vote_start", { questionId, answerMode: "binary", source: "detail" });
    setSubmitting(true);
    setError(null);
    setChoice(nextChoice);
    setVoteCooldownUntil(Date.now() + FV_VOTE_COOLDOWN_DEFAULT_MS);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, choice: nextChoice }),
      });

      if (res.status === 429) {
        const data = (await res.json()) as { retryAfterMs?: number };
        const retry = Math.ceil(((data.retryAfterMs ?? 1000) as number) / 1000);
        setChoice(prevChoice);
        setVoteCooldownUntil(Date.now() + Math.max(0, data.retryAfterMs ?? 0));
        setError(`Bitte warte ${retry} Sekunde(n), bevor du erneut votest.`);
        showToast(`Bitte warte ${retry} Sekunde(n), bevor du erneut votest.`, "error");
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setChoice(prevChoice);
        clearVoteCooldown();
        setError(data?.error || "Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut.");
        showToast(data?.error || "Deine Stimme konnte nicht gespeichert werden.", "error");
        return;
      }

      const payload = (await res.json().catch(() => null)) as VoteResponse | null;
      if (payload?.alreadyVoted) {
        // Seriosität: pro Account nur eine Stimme – wir zeigen die echte gespeicherte Stimme an.
        const actual = payload?.question?.userChoice === "yes" || payload?.question?.userChoice === "no" ? payload.question.userChoice : prevChoice;
        setChoice(actual);
        if (actual === "yes" || actual === "no") {
          recordFeedVoteDelta({ kind: "binary", questionId, choice: actual });
        }
        clearVoteCooldown();
        setError(null);
        showToast("Du hast bereits abgestimmt.", "error");
        router.refresh();
        return;
      }

      invalidateProfileCaches();
      triggerAhaMicrocopy({
        closesAt: closesAt ?? null,
        questionId,
        questionTitle,
        shareUrl: shareUrl ?? `${window.location.origin}/questions/${encodeURIComponent(questionId)}`,
        choiceLabel: nextChoice === "yes" ? "Ja" : "Nein",
      });
      recordFeedVoteDelta({ kind: "binary", questionId, choice: nextChoice });
      router.refresh();
    } catch {
      setChoice(prevChoice);
      clearVoteCooldown();
      setError("Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut.");
      showToast("Deine Stimme konnte nicht gespeichert werden.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoteOption = async (nextOptionId: string) => {
    if (hasOption || submitting || effectiveAnswerMode !== "options") return;
    const cooldownSeconds = getVoteCooldownRemainingSeconds();
    if (cooldownSeconds > 0) {
      setError(`Bitte warte ${cooldownSeconds} Sekunde(n), bevor du erneut votest.`);
      showToast(`Bitte warte ${cooldownSeconds} Sekunde(n), bevor du erneut votest.`, "error");
      return;
    }
    const prevOptionId = optionId;
    trackEvent("vote_start", { questionId, answerMode: "options", source: "detail" });
    setSubmitting(true);
    setError(null);
    setOptionId(nextOptionId);
    setVoteCooldownUntil(Date.now() + FV_VOTE_COOLDOWN_DEFAULT_MS);

    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionId, optionId: nextOptionId }),
      });

      if (res.status === 429) {
        const data = (await res.json()) as { retryAfterMs?: number };
        const retry = Math.ceil(((data.retryAfterMs ?? 1000) as number) / 1000);
        setOptionId(prevOptionId);
        setVoteCooldownUntil(Date.now() + Math.max(0, data.retryAfterMs ?? 0));
        setError(`Bitte warte ${retry} Sekunde(n), bevor du erneut votest.`);
        showToast(`Bitte warte ${retry} Sekunde(n), bevor du erneut votest.`, "error");
        return;
      }

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setOptionId(prevOptionId);
        clearVoteCooldown();
        setError(data?.error || "Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut.");
        showToast(data?.error || "Deine Stimme konnte nicht gespeichert werden.", "error");
        return;
      }

      const payload = (await res.json().catch(() => null)) as VoteResponse | null;
      if (payload?.alreadyVoted) {
        const actual = typeof payload?.question?.userOptionId === "string" ? payload.question.userOptionId : prevOptionId;
        setOptionId(actual ?? null);
        if (typeof actual === "string" && actual) {
          recordFeedVoteDelta({ kind: "options", questionId, optionId: actual });
        }
        clearVoteCooldown();
        setError(null);
        showToast("Du hast bereits abgestimmt.", "error");
        router.refresh();
        return;
      }

      invalidateProfileCaches();
      const label = (options ?? []).find((o) => o.id === nextOptionId)?.label;
      triggerAhaMicrocopy({
        closesAt: closesAt ?? null,
        questionId,
        questionTitle,
        shareUrl: shareUrl ?? `${window.location.origin}/questions/${encodeURIComponent(questionId)}`,
        choiceLabel: label ?? "Abgestimmt",
      });
      recordFeedVoteDelta({ kind: "options", questionId, optionId: nextOptionId });
      router.refresh();
    } catch {
      setOptionId(prevOptionId);
      clearVoteCooldown();
      setError("Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut.");
      showToast("Deine Stimme konnte nicht gespeichert werden.", "error");
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

      {toast ? (
        <div className="toast-enter fixed bottom-4 right-4 z-50 rounded-2xl border border-white/15 bg-slate-900/90 px-4 py-3 shadow-lg shadow-black/40">
          <div className={`text-sm font-semibold ${toast.type === "success" ? "text-emerald-200" : "text-rose-200"}`}>
            {toast.message}
          </div>
        </div>
      ) : null}
    </div>
  );
}
