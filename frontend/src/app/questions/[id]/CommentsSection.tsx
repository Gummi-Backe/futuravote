"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type CommentStance = "yes" | "no" | "neutral";

type QuestionComment = {
  id: string;
  authorName: string;
  stance: CommentStance;
  body: string;
  sourceUrl: string | null;
  createdAt: string;
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

function stanceLabel(stance: CommentStance) {
  if (stance === "yes") return "Ja";
  if (stance === "no") return "Nein";
  return "Neutral";
}

function stanceClass(stance: CommentStance) {
  if (stance === "yes") return "border-emerald-300/40 bg-emerald-500/10 text-emerald-50";
  if (stance === "no") return "border-rose-300/40 bg-rose-500/10 text-rose-50";
  return "border-white/10 bg-white/5 text-slate-100";
}

export function CommentsSection({
  questionId,
  isLoggedIn,
  canPost,
}: {
  questionId: string;
  isLoggedIn: boolean;
  canPost: boolean;
}) {
  const [comments, setComments] = useState<QuestionComment[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [stance, setStance] = useState<CommentStance>("neutral");
  const [body, setBody] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

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

  const canSubmit = useMemo(() => {
    if (!canPost) return false;
    const text = body.trim();
    if (text.length < 5) return false;
    if (text.length > 2000) return false;
    return true;
  }, [body, canPost]);

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
        setComments((prev) => ([...(prev ?? []), next] as QuestionComment[]));
      } else {
        await fetchComments();
      }
      setBody("");
      setSourceUrl("");
      setStance("neutral");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Kommentar konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  }, [body, canSubmit, fetchComments, questionId, sourceUrl, stance, submitting]);

  return (
    <section className="mt-8 rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl shadow-black/25 backdrop-blur sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-white">Diskussion</h2>
          <p className="mt-1 text-xs text-slate-300">
            Kurz, sachlich, gerne mit Quelle. Das hilft, spaeter sauber aufzulosen.
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
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-200">
          Login ist erforderlich, um zu kommentieren.
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
                  onClick={() => setStance(s)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold transition hover:-translate-y-0.5 ${
                    active ? stanceClass(s) : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/30"
                  }`}
                  aria-pressed={active}
                >
                  {stanceLabel(s)}
                </button>
              );
            })}
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
                  placeholder="Was spricht dafuer/dagegen?"
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
              className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 shadow-sm shadow-black/20"
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
                        {stanceLabel(c.stance)}
                      </span>
                      <span className="text-[11px] text-slate-400">{formatTime(c.createdAt)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-sm text-slate-200">
                {c.body}
              </p>
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
