"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Draft } from "@/app/data/mock";
import { invalidateProfileCaches } from "@/app/lib/profileCache";

type DraftReviewChoice = "good" | "bad";

const REVIEWED_DRAFT_CHOICES_STORAGE_KEY = "fv_reviewed_draft_choices_v1";

function VoteBar({ yesPct, noPct }: { yesPct: number; noPct: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-emerald-400 transition-all duration-500 ease-out" style={{ width: `${yesPct}%` }} />
      <div
        className="absolute right-0 top-0 h-full bg-rose-400 transition-all duration-500 ease-out"
        style={{ width: `${noPct}%` }}
      />
    </div>
  );
}

function formatDraftTimeLeft(timeLeftHours: number) {
  if (timeLeftHours <= 0) return "Review vorbei";
  if (timeLeftHours < 24) return `Noch ${timeLeftHours}h`;
  const days = Math.floor(timeLeftHours / 24);
  const rest = timeLeftHours % 24;
  return rest > 0 ? `Noch ${days}d ${rest}h` : `Noch ${days}d`;
}

export function DraftReviewClient({
  initialDraft,
  alreadyReviewedInitial,
  readOnly = false,
}: {
  initialDraft: Draft;
  alreadyReviewedInitial: boolean;
  readOnly?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(initialDraft);
  const [submitting, setSubmitting] = useState(false);
  const [hasVoted, setHasVoted] = useState(alreadyReviewedInitial || readOnly);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<DraftReviewChoice | null>(null);

  useEffect(() => {
    if (readOnly) return;
    try {
      const raw = localStorage.getItem(REVIEWED_DRAFT_CHOICES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return;
      const value = (parsed as Record<string, unknown>)[draft.id];
      if (value === "good" || value === "bad") setSelectedChoice(value);
    } catch {
      // ignore
    }
  }, [draft.id]);

  const totalReviews = draft.votesFor + draft.votesAgainst;
  const yesPct = Math.round((draft.votesFor / Math.max(1, totalReviews)) * 100);
  const noPct = 100 - yesPct;

  const lead = Math.abs(draft.votesFor - draft.votesAgainst);
  const reviewsRemaining = Math.max(0, 5 - totalReviews);
  const leadRemaining = Math.max(0, 2 - lead);
  const thresholdReached = totalReviews >= 5 && lead >= 2;

  const statusLabel =
    draft.status === "accepted" ? "Angenommen" : draft.status === "rejected" ? "Abgelehnt" : "Offen";
  const statusClass =
    draft.status === "accepted"
      ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/40"
      : draft.status === "rejected"
        ? "bg-rose-500/15 text-rose-100 border border-rose-400/40"
        : "bg-sky-500/15 text-sky-100 border border-sky-400/30";

  const disabled =
    readOnly || submitting || hasVoted || draft.status === "accepted" || draft.status === "rejected";
  const hasReviewChoice = selectedChoice === "good" || selectedChoice === "bad";

  const thresholdText = useMemo(() => {
    const partA =
      reviewsRemaining > 0
        ? `Noch ${reviewsRemaining} Reviews bis mind. 5 (${totalReviews}/5)`
        : `Mindestens 5 Reviews erreicht (${totalReviews}/5)`;
    const partB = thresholdReached
      ? `Schwelle erreicht (${lead}/2)`
      : leadRemaining > 0
        ? `Noch ${leadRemaining} Vorsprung bis Entscheidung (${lead}/2)`
        : `Vorsprung erreicht (${lead}/2)`;
    return { partA, partB };
  }, [lead, leadRemaining, reviewsRemaining, thresholdReached, totalReviews]);

  const submit = useCallback(
    async (choice: DraftReviewChoice) => {
      if (disabled) return;
      setSubmitting(true);
      setMessage(null);
      setSelectedChoice(choice);

      try {
        const res = await fetch("/api/drafts/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId: draft.id, choice }),
        });

        const json = await res.json().catch(() => null);
        if (!res.ok) {
          setMessage(json?.error ?? "Konnte Review nicht speichern.");
          return;
        }

        invalidateProfileCaches();

        if (json?.alreadyVoted) {
          setHasVoted(true);
          setMessage("Du hast dieses Draft bereits bewertet.");
          return;
        }

        try {
          const currentRaw = localStorage.getItem(REVIEWED_DRAFT_CHOICES_STORAGE_KEY);
          const current = currentRaw ? (JSON.parse(currentRaw) as unknown) : {};
          const safeCurrent = current && typeof current === "object" ? (current as Record<string, unknown>) : {};
          safeCurrent[draft.id] = choice;
          localStorage.setItem(REVIEWED_DRAFT_CHOICES_STORAGE_KEY, JSON.stringify(safeCurrent));
        } catch {
          // ignore
        }

        if (json?.draft) {
          setDraft(json.draft as Draft);
        }
        setHasVoted(true);
        setMessage("Danke! Dein Review ist gespeichert.");
      } catch (err) {
        console.error(err);
        setMessage("Netzwerkfehler. Bitte versuche es erneut.");
      } finally {
        setSubmitting(false);
      }
    },
    [disabled, draft.id]
  );

  return (
    <article className="flex w-full max-w-xl flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-sky-500/15 mx-auto">
      <div className="flex items-center justify-between text-xs text-slate-200">
        <span className={`rounded-full px-3 py-1 font-semibold ${statusClass}`}>{statusLabel}</span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">{formatDraftTimeLeft(draft.timeLeftHours)}</span>
      </div>

      <div className="flex gap-3">
        {draft.imageUrl && (
          <div className="inline-flex max-h-20 max-w-[6rem] flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black/30">
            <img
              src={draft.imageUrl}
              alt={draft.title}
              className="h-auto w-auto max-h-20 max-w-[6rem] object-contain"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1">
          <h1 className="card-title-wrap text-lg font-semibold leading-snug text-white">{draft.title}</h1>
          {draft.imageCredit && <p className="mt-1 text-[10px] text-slate-400 line-clamp-1">{draft.imageCredit}</p>}
        </div>
      </div>

      <p className="text-xs font-medium uppercase tracking-wide text-slate-300">{draft.category}</p>
      {draft.answerMode === "options" && (draft.options?.length ?? 0) > 0 ? (
        <div className="space-y-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Antwortoptionen</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-200">
            {(draft.options ?? []).slice(0, 6).map((opt) => (
              <div key={opt.id} className="min-w-0 truncate" title={opt.label}>
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {draft.description && <p className="text-xs text-slate-200">{draft.description}</p>}

      <div className="flex items-center gap-2 text-xs text-slate-200">
        <span className="font-semibold text-emerald-200">{draft.votesFor} Gut ({yesPct}%)</span>
        <span className="text-slate-400">·</span>
        <span className="font-semibold text-rose-200">{draft.votesAgainst} Schlecht ({noPct}%)</span>
      </div>
      <VoteBar yesPct={yesPct} noPct={noPct} />

      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
        <span>{thresholdText.partA}</span>
        <span>{thresholdText.partB}</span>
      </div>

      {readOnly ? (
        <p className="text-xs text-slate-400">
          Du bist der Ersteller. Teile den Link - Bewertungen kommen von anderen.
        </p>
      ) : (
        <div className="flex gap-3">
          <button
            type="button"
            className={`card-button yes w-full ${
              selectedChoice === "good"
                ? "ring-2 ring-emerald-200/80 border-emerald-200/80 brightness-110 shadow-[0_0_0_2px_rgba(52,211,153,0.32),0_0_46px_rgba(52,211,153,0.62)]"
                : hasReviewChoice
                  ? "opacity-30 saturate-50"
                  : "hover:shadow-[0_0_18px_rgba(52,211,153,0.25)]"
            } ${submitting ? "opacity-70 cursor-wait" : ""}`}
            disabled={disabled}
            onClick={() => submit("good")}
          >
            Gute Frage
          </button>
          <button
            type="button"
            className={`card-button no w-full ${
              selectedChoice === "bad"
                ? "ring-2 ring-rose-200/80 border-rose-200/80 brightness-110 shadow-[0_0_0_2px_rgba(248,113,113,0.32),0_0_46px_rgba(248,113,113,0.62)]"
                : hasReviewChoice
                  ? "opacity-30 saturate-50"
                  : "hover:shadow-[0_0_18px_rgba(248,113,113,0.25)]"
            } ${submitting ? "opacity-70 cursor-wait" : ""}`}
            disabled={disabled}
            onClick={() => submit("bad")}
          >
            Ablehnen
          </button>
        </div>
      )}

      {message ? (
        <div
          className={`rounded-2xl border px-4 py-3 text-xs ${
            message.includes("Danke") || message.includes("gespeichert")
              ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
              : "border-rose-400/30 bg-rose-500/10 text-rose-100"
          }`}
        >
          {message}
        </div>
      ) : null}
    </article>
  );
}
