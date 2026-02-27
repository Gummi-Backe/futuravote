"use client";

import { useCallback, useMemo, useState } from "react";
import { FormattedText } from "@/app/components/FormattedText";
import { convertHtmlToMarkup } from "@/app/lib/htmlToMarkup";

type QuestionUpdate = {
  id: string;
  questionId: string;
  userId: string;
  authorName: string;
  body: string;
  sourceUrl: string | null;
  sourceUrls: string[];
  createdAt: string;
};

type AiSuggestion = {
  body: string;
  sourceUrl: string | null;
  sourceUrls: string[];
  sources: string[];
};

const MIN_UPDATE_CHARS = 10;
const MAX_UPDATE_CHARS = 8000;
const MAX_SOURCE_URLS = 8;

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

export function QuestionUpdatesSection(props: {
  questionId: string;
  questionTitle: string;
  initialUpdates: QuestionUpdate[];
  isLoggedIn: boolean;
  isOwner: boolean;
  isAdmin: boolean;
}) {
  const { questionId, questionTitle, initialUpdates, isLoggedIn, isOwner, isAdmin } = props;
  const [updates, setUpdates] = useState<QuestionUpdate[]>(initialUpdates ?? []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [body, setBody] = useState("");
  const [sourceUrls, setSourceUrls] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiContext, setAiContext] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiSuggestion, setAiSuggestion] = useState<AiSuggestion | null>(null);

  const canSubmit = useMemo(() => {
    if (!isOwner) return false;
    const textLen = body.trim().length;
    return textLen >= MIN_UPDATE_CHARS && textLen <= MAX_UPDATE_CHARS;
  }, [body, isOwner]);

  const refresh = useCallback(async () => {
    if (!questionId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/questions/${encodeURIComponent(questionId)}/updates`, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | { error?: string; updates?: QuestionUpdate[] }
        | null;
      if (!res.ok) throw new Error(json?.error ?? "Updates konnten nicht geladen werden.");
      setUpdates(Array.isArray(json?.updates) ? json.updates : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Updates konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [questionId]);

  const submit = useCallback(async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    setError(null);
    const normalizedSourceUrls = sourceUrls
      .map((value) => value.trim())
      .filter(Boolean)
      .slice(0, MAX_SOURCE_URLS);
    try {
      const res = await fetch(`/api/questions/${encodeURIComponent(questionId)}/updates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: body.trim(),
          sourceUrl: normalizedSourceUrls[0] ?? null,
          sourceUrls: normalizedSourceUrls,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { error?: string; update?: QuestionUpdate }
        | null;
      if (!res.ok) throw new Error(json?.error ?? "Update konnte nicht gespeichert werden.");
      const next = json?.update;
      if (next) {
        setUpdates((prev) => [next, ...(prev ?? [])]);
      } else {
        await refresh();
      }
      setBody("");
      setSourceUrls([""]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Update konnte nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  }, [body, canSubmit, questionId, refresh, sourceUrls, submitting]);

  const generateAiSuggestion = useCallback(async () => {
    if (!isAdmin || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    setAiSuggestion(null);
    try {
      const res = await fetch("/api/admin/question-update-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionId,
          context: aiContext.trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { error?: string; suggestion?: AiSuggestion }
        | null;
      if (!res.ok) throw new Error(json?.error ?? "KI-Update konnte nicht erstellt werden.");
      setAiSuggestion(json?.suggestion ?? null);
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : "KI-Update konnte nicht erstellt werden.");
    } finally {
      setAiLoading(false);
    }
  }, [aiContext, aiLoading, isAdmin, questionId]);

  const applySuggestion = useCallback(() => {
    if (!aiSuggestion || !isOwner) return;
    setBody(aiSuggestion.body ?? "");
    const merged = [...(aiSuggestion.sourceUrls ?? []), ...(aiSuggestion.sources ?? []), aiSuggestion.sourceUrl ?? ""]
      .map((value) => value.trim())
      .filter(Boolean);
    const deduped: string[] = [];
    const seen = new Set<string>();
    for (const value of merged) {
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(value);
      if (deduped.length >= MAX_SOURCE_URLS) break;
    }
    setSourceUrls(deduped.length ? deduped : [""]);
  }, [aiSuggestion, isOwner]);

  const copySuggestion = useCallback(async () => {
    if (!aiSuggestion?.body) return;
    try {
      await navigator.clipboard.writeText(aiSuggestion.body);
    } catch {}
  }, [aiSuggestion]);

  const handleRichTextPaste = useCallback((event: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const html = event.clipboardData.getData("text/html");
    if (!html) return;

    const converted = convertHtmlToMarkup(html);
    if (!converted) return;

    event.preventDefault();
    const target = event.currentTarget;
    const start = target.selectionStart ?? 0;
    const end = target.selectionEnd ?? start;
    setBody((prev) => `${prev.slice(0, start)}${converted}${prev.slice(end)}`);

    requestAnimationFrame(() => {
      const nextCaret = start + converted.length;
      target.selectionStart = nextCaret;
      target.selectionEnd = nextCaret;
    });
  }, []);

  return (
    <section className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl shadow-black/25 backdrop-blur sm:mt-8 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Updates zur Frage</h2>
          <p className="mt-1 text-xs text-slate-300">
            Neue Entwicklungen können hier ergänzt werden. Formatierung aus Word/Paste wird übernommen.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-200/30"
        >
          {loading ? "Aktualisiere..." : "Aktualisieren"}
        </button>
      </div>

      {isAdmin ? (
        <div className="mt-4 rounded-2xl border border-cyan-200/25 bg-cyan-500/10 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold text-cyan-100">KI-Assist (Admin, Perplexity)</div>
            <button
              type="button"
              onClick={() => setAiOpen((v) => !v)}
              className="rounded-full border border-cyan-200/30 bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-50 hover:border-cyan-200/60"
            >
              {aiOpen ? "Schließen" : "Öffnen"}
            </button>
          </div>

          {aiOpen ? (
            <div className="mt-3 space-y-3">
              <p className="text-xs text-cyan-100/90">
                Erstellt einen neutralen Update-Entwurf aus Frage, Beschreibung und Langtext.
              </p>
              <label className="block text-xs font-semibold text-slate-200">
                Anlass/Hinweis (optional)
                <textarea
                  value={aiContext}
                  onChange={(e) => setAiContext(e.target.value)}
                  rows={2}
                  className="mt-1 w-full resize-none rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-cyan-300/50"
                  placeholder={`z. B. Neue Umfragewerte oder neue Entwicklung zu: ${questionTitle}`}
                />
              </label>
              <button
                type="button"
                onClick={() => void generateAiSuggestion()}
                disabled={aiLoading}
                className="rounded-xl border border-cyan-200/35 bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-50 hover:-translate-y-0.5 disabled:opacity-60"
              >
                {aiLoading ? "Generiere..." : "KI-Update vorschlagen"}
              </button>

              {aiError ? <p className="text-xs text-rose-200">{aiError}</p> : null}

              {aiSuggestion ? (
                <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs font-semibold text-slate-100">Vorschlag</p>
                  <FormattedText
                    text={aiSuggestion.body}
                    className="mt-2 space-y-2 text-sm text-slate-200"
                    paragraphClassName="text-sm text-slate-200"
                  />
                  {(() => {
                    const allSources = [...(aiSuggestion.sourceUrls ?? []), ...(aiSuggestion.sources ?? []), aiSuggestion.sourceUrl ?? ""]
                      .map((value) => value.trim())
                      .filter(Boolean);
                    const deduped: string[] = [];
                    const seen = new Set<string>();
                    for (const value of allSources) {
                      const key = value.toLowerCase();
                      if (seen.has(key)) continue;
                      seen.add(key);
                      deduped.push(value);
                      if (deduped.length >= MAX_SOURCE_URLS) break;
                    }
                    if (deduped.length === 0) return null;
                    return (
                      <div className="mt-2 space-y-1">
                        {deduped.map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="block text-xs font-semibold text-emerald-200 hover:text-emerald-100 break-all"
                          >
                            Quelle: {url}
                          </a>
                        ))}
                      </div>
                    );
                  })()}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {isOwner ? (
                      <button
                        type="button"
                        onClick={applySuggestion}
                        className="rounded-full border border-emerald-300/35 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-50 hover:border-emerald-200/70"
                      >
                        Ins Update übernehmen
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void copySuggestion()}
                      className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-cyan-200/40"
                    >
                      Text kopieren
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {isOwner ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <label className="block text-xs font-semibold text-slate-200">
            Neues Update
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onPaste={handleRichTextPaste}
              rows={5}
              className="mt-1 w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50"
              placeholder="Was hat sich seit Veröffentlichung verändert?"
            />
          </label>
          <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
            <span>{body.trim().length < MIN_UPDATE_CHARS ? `Mind. ${MIN_UPDATE_CHARS} Zeichen.` : " "}</span>
            <span>{Math.min(MAX_UPDATE_CHARS, body.length)}/{MAX_UPDATE_CHARS}</span>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-200">Quellen (optional)</div>
              <div className="space-y-2">
                {sourceUrls.map((value, idx) => (
                  <div key={`source-${idx}`} className="flex items-center gap-2">
                    <input
                      value={value}
                      onChange={(e) =>
                        setSourceUrls((prev) =>
                          prev.map((entry, entryIdx) => (entryIdx === idx ? e.target.value : entry))
                        )
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none focus:border-emerald-300/50"
                      placeholder="https://..."
                      inputMode="url"
                    />
                    {sourceUrls.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          setSourceUrls((prev) => {
                            const next = prev.filter((_, entryIdx) => entryIdx !== idx);
                            return next.length > 0 ? next : [""];
                          })
                        }
                        className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-100 hover:border-rose-200/40"
                        aria-label="Quelle entfernen"
                        title="Quelle entfernen"
                      >
                        ✕
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() =>
                  setSourceUrls((prev) =>
                    prev.length >= MAX_SOURCE_URLS ? prev : [...prev, ""]
                  )
                }
                disabled={sourceUrls.length >= MAX_SOURCE_URLS}
                className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-emerald-200/40 disabled:opacity-50"
              >
                Weitere Quelle
              </button>
            </div>
            <button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit || submitting}
              className="self-end rounded-xl border border-emerald-300/35 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-emerald-50 shadow-lg shadow-emerald-500/10 transition hover:-translate-y-0.5 hover:border-emerald-300/65 disabled:opacity-60"
            >
              {submitting ? "Speichere..." : "Update veröffentlichen"}
            </button>
          </div>
        </div>
      ) : isLoggedIn ? (
        <p className="mt-4 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-300">
          Nur der Ersteller dieser Frage kann Updates veröffentlichen.
        </p>
      ) : (
        <p className="mt-4 rounded-2xl border border-amber-300/35 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          Login erforderlich, um eigene Updates zu veröffentlichen.
        </p>
      )}

      {error ? <p className="mt-3 text-xs text-rose-200">{error}</p> : null}

      <div className="mt-5 space-y-3">
        {updates.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-xs text-slate-300">
            Noch keine Updates veröffentlicht.
          </div>
        ) : (
          updates.map((item) => (
            <article key={item.id} className="rounded-3xl border border-white/10 bg-black/20 px-4 py-3 shadow-sm shadow-black/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-100">{item.authorName}</span>
                <span className="text-[11px] text-slate-400">{formatTime(item.createdAt)}</span>
              </div>
              <FormattedText
                text={item.body}
                className="mt-2 space-y-2 text-sm text-slate-200"
                paragraphClassName="text-sm text-slate-200"
              />
              {(() => {
                const allSources = [...(item.sourceUrls ?? []), item.sourceUrl ?? ""]
                  .map((value) => value.trim())
                  .filter(Boolean);
                const deduped: string[] = [];
                const seen = new Set<string>();
                for (const value of allSources) {
                  const key = value.toLowerCase();
                  if (seen.has(key)) continue;
                  seen.add(key);
                  deduped.push(value);
                  if (deduped.length >= MAX_SOURCE_URLS) break;
                }
                if (deduped.length === 0) return null;
                return (
                  <div className="mt-2 space-y-1">
                    {deduped.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-xs font-semibold text-emerald-200 hover:text-emerald-100 break-all"
                      >
                        Quelle: {url}
                      </a>
                    ))}
                  </div>
                );
              })()}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
