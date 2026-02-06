"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type CommentStance = "yes" | "no" | "neutral";
type AnswerMode = "binary" | "options";

type QuestionComment = {
  id: string;
  authorName: string;
  stance: CommentStance;
  body: string;
  sourceUrl: string | null;
  createdAt: string;
  upVotes?: number;
  myVote?: "up" | null;
};

function formatTime(value: string) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Date(ms).toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function avatarLetters(name: string) {
  const letters = name
    .split(" ")
    .filter(Boolean)
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return letters || "U";
}

function stanceLabel(answerMode: AnswerMode, stance: CommentStance) {
  if (answerMode === "options") {
    if (stance === "yes") return "Pro";
    if (stance === "no") return "Contra";
    return "Neutral";
  }

  if (stance === "yes") return "Ja";
  if (stance === "no") return "Nein";
  return "Neutral";
}

function stanceClass(stance: CommentStance) {
  if (stance === "yes") return "border-emerald-300/40 bg-emerald-500/10 text-emerald-50";
  if (stance === "no") return "border-rose-300/40 bg-rose-500/10 text-rose-50";
  return "border-white/10 bg-white/5 text-slate-100";
}

function stanceCardClass(stance: CommentStance) {
  if (stance === "yes") {
    return "border-emerald-300/25 bg-gradient-to-br from-emerald-500/10 via-black/20 to-black/10";
  }
  if (stance === "no") {
    return "border-rose-300/25 bg-gradient-to-br from-rose-500/10 via-black/20 to-black/10";
  }
  return "border-white/10 bg-black/20";
}

export function CommentsSection({
  questionId,
  answerMode,
  userChoice,
  isLoggedIn,
  canPost,
}: {
  questionId: string;
  answerMode: AnswerMode;
  userChoice: "yes" | "no" | null;
  isLoggedIn: boolean;
  canPost: boolean;
}) {
  const [comments, setComments] = useState<QuestionComment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stance, setStance] = useState<CommentStance | null>(answerMode === "options" ? null : "neutral");
  const [stanceTouched, setStanceTouched] = useState(false);
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [voteSubmittingId, setVoteSubmittingId] = useState<string | null>(null);

  const fetchComments = useCallback(async () => {
    if (!questionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${encodeURIComponent(questionId)}/comments`, { cache: "no-store" });
      const json: any = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Kommentare konnten nicht geladen werden.");
      const list = Array.isArray(json?.comments) ? (json.comments as QuestionComment[]) : [];
      setComments(list);
    } catch (e: unknown) {
      setComments([]);
      setError(e instanceof Error ? e.message : "Kommentare konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  useEffect(() => {
    if (answerMode === "options") {
      // For options questions: no preselection.
      setStance(null);
      setStanceTouched(false);
      return;
    }

    // For binary questions: default to user's vote (still changeable).
    if (!stanceTouched) {
      setStance(userChoice === "yes" ? "yes" : userChoice === "no" ? "no" : "neutral");
    }
  }, [answerMode, stanceTouched, userChoice]);

  const canSubmit = useMemo(() => {
    if (!canPost) return false;
    if (!stance) return false;
    const text = body.trim();
    if (text.length < 5) return false;
    if (text.length > 2000) return false;
    return true;
  }, [body, canPost, stance]);

  const submit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${encodeURIComponent(questionId)}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stance,
          body: body.trim(),
          sourceUrl: sourceUrl.trim() || null,
        }),
      });
      const json: any = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Kommentar konnte nicht gespeichert werden.");
      const next = json?.comment as QuestionComment | undefined;
      if (next) {
        setComments((prev) => ([...(prev ?? []), { ...next, upVotes: 0, myVote: null }] as QuestionComment[]));
      } else {
        await fetchComments();
      }
      setBody("");
      setSourceUrl("");
      setStance(answerMode === "options" ? null : "neutral");
      setStanceTouched(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kommentar konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  }, [answerMode, body, canSubmit, fetchComments, questionId, sourceUrl, stance, submitting]);

  const voteOnComment = useCallback(
    async (commentId: string) => {
      if (!isLoggedIn || voteSubmittingId) return;
      setVoteSubmittingId(commentId);
      setError(null);
      try {
        const res = await fetch(
          `/api/questions/${encodeURIComponent(questionId)}/comments/${encodeURIComponent(commentId)}/vote`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ vote: "up" }),
          }
        );
        const json: any = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error ?? "Vote konnte nicht gespeichert werden.");
        const upVotes = Number(json?.upVotes ?? 0) || 0;
        const myVote = json?.myVote === "up" ? "up" : null;
        setComments((prev) =>
          (prev ?? []).map((c) => (c.id === commentId ? { ...c, upVotes, myVote } : c))
        );
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Vote konnte nicht gespeichert werden.");
      } finally {
        setVoteSubmittingId(null);
      }
    },
    [isLoggedIn, questionId, voteSubmittingId]
  );

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl shadow-black/25 backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Diskussion</h2>
          <p className="mt-1 text-xs text-slate-300">
            Kurz, sachlich, gerne mit Quelle. Das hilft, später sauber aufzulösen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void fetchComments()}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-200/30"
        >
          Aktualisieren
        </button>
      </div>

      {!isLoggedIn ? (
        <div className="mt-4 rounded-2xl border border-amber-300/35 bg-amber-500/10 px-4 py-3">
          <p className="text-sm font-semibold text-amber-50">
            Login ist erforderlich, um zu kommentieren.
          </p>
          <p className="mt-1 text-xs text-amber-100/90">
            Logge dich ein oder erstelle einen Account, dann kannst du deine Meinung hinzufügen.
          </p>
          <Link
            href={`/auth?next=${encodeURIComponent(`/questions/${questionId}`)}`}
            className="mt-3 inline-flex w-full items-center justify-center rounded-2xl border border-amber-200/50 bg-amber-500/20 px-4 py-2 text-sm font-semibold text-amber-50 shadow-lg shadow-amber-500/10 transition hover:-translate-y-0.5 hover:border-amber-200/70 hover:bg-amber-500/25"
          >
            Login / Registrieren
          </Link>
        </div>
      ) : !canPost ? (
        <div className="mt-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-50">
          Bitte bestätige zuerst deine E-Mail, um kommentieren zu können.
        </div>
      ) : (
        <div className="mt-4 rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="flex flex-wrap items-center gap-2">
            {(["yes", "no", "neutral"] as const).map((s) => {
              const active = stance === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStance(s);
                    setStanceTouched(true);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition hover:-translate-y-0.5 ${
                    active ? stanceClass(s) : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/30"
                  }`}
                  aria-pressed={active}
                >
                  {stanceLabel(answerMode, s)}
                </button>
              );
            })}
            {answerMode === "options" && stance === null ? (
              <span className="ml-1 text-[11px] font-semibold text-slate-300">
                Bitte wähle Pro, Contra oder Neutral.
              </span>
            ) : null}
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-200">
                Kommentar
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  rows={4}
                  className="mt-1 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50"
                  placeholder="Was spricht dafür oder dagegen?"
                />
              </label>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>{body.trim().length < 5 ? "Mind. 5 Zeichen." : " "}</span>
                <span>{Math.min(2000, body.length)}/2000</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-200">
                Quelle (optional)
                <input
                  value={sourceUrl}
                  onChange={(e) => setSourceUrl(e.target.value)}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50"
                  placeholder="https://..."
                  inputMode="url"
                />
              </label>
              <p className="mt-2 text-[11px] text-slate-400">
                Tipp: Offizielle Seiten / Artikel verlinken.
              </p>
              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={() => void submit()}
                className="mt-3 w-full rounded-2xl border border-emerald-300/30 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-50 shadow-lg shadow-emerald-500/10 transition hover:-translate-y-0.5 hover:border-emerald-300/60 disabled:opacity-60"
              >
                {submitting ? "Sende..." : "Kommentar posten"}
              </button>
            </div>
          </div>
        </div>
      )}

      {error ? <p className="mt-3 text-xs text-rose-200">{error}</p> : null}

      <div className="mt-5 space-y-3">
        {loading && comments?.length ? <p className="text-xs text-slate-400">Aktualisiere...</p> : null}
        {comments === null ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="animate-pulse rounded-3xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm shadow-black/20"
              >
                <div className="h-3 w-40 rounded bg-white/10" />
                <div className="mt-2 h-3 w-11/12 rounded bg-white/10" />
                <div className="mt-2 h-3 w-9/12 rounded bg-white/10" />
              </div>
            ))}
          </div>
        ) : comments.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-200">
            Noch keine Kommentare. Sei der Erste.
          </div>
        ) : (
          comments.map((c) => (
            <article
              key={c.id}
              className={`rounded-3xl border px-4 py-3 shadow-sm shadow-black/20 ${stanceCardClass(c.stance)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/15 text-xs font-semibold text-emerald-50">
                    {avatarLetters(c.authorName)}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-semibold text-white">{c.authorName}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${stanceClass(c.stance)}`}>
                        {stanceLabel(answerMode, c.stance)}
                      </span>
                      <span className="text-[11px] text-slate-400">{formatTime(c.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm text-slate-200">
                {c.body}
              </p>

              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void voteOnComment(c.id)}
                  disabled={!isLoggedIn || Boolean(voteSubmittingId)}
                  className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50 ${
                    c.myVote === "up"
                      ? "border-rose-200/60 bg-rose-500/20 text-rose-50"
                      : "border-white/10 bg-white/5 text-slate-200 hover:border-rose-200/30"
                  }`}
                  aria-pressed={c.myVote === "up"}
                  title={isLoggedIn ? "Gefällt mir" : "Login ist erforderlich"}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M20.8 4.6a5.3 5.3 0 0 0-7.5 0L12 5.9l-1.3-1.3a5.3 5.3 0 0 0-7.5 7.5l1.3 1.3L12 21.9l7.5-7.5 1.3-1.3a5.3 5.3 0 0 0 0-7.5Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>{Math.max(0, Number(c.upVotes ?? 0) || 0)}</span>
                </button>
              </div>
              {c.sourceUrl ? (
                <a
                  href={c.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block max-w-full break-all [overflow-wrap:anywhere] text-xs font-semibold text-emerald-100 hover:text-emerald-200"
                >
                  Quelle: {c.sourceUrl}
                </a>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
