"use client";

import { useCallback, useMemo, useState } from "react";
import { categories } from "@/app/data/mock";

type Mode = "category" | "theme";

export type QuestionSuggestion = {
  title: string;
  description: string;
  category: string;
  region: string | null;
  isResolvable: boolean;
  answerMode: "binary" | "options";
  options: string[];
  imagePrompt: string;
  reviewHours: number;
  pollEndAt: string;
  resolutionCriteria: string;
  resolutionSource: string;
  resolutionDeadlineAt: string;
  sources: string[];
};

function formatDateTime(value: string) {
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

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center rounded-full border px-3 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5 ${
        active ? "border-emerald-300/60 bg-emerald-500/20 text-white" : "border-white/10 bg-white/5 text-slate-100"
      }`}
    >
      {label}
    </button>
  );
}

export function AdminAiAssistant({
  isAdmin,
  onApply,
  requestedIsResolvable,
  requestedAnswerMode,
  requestedVisibility,
}: {
  isAdmin: boolean;
  onApply: (s: QuestionSuggestion) => void;
  requestedIsResolvable?: boolean;
  requestedAnswerMode?: "binary" | "options";
  requestedVisibility?: "public" | "link_only";
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("category");
  const [category, setCategory] = useState<string>(categories[0]?.label ?? "Politik");
  const [region, setRegion] = useState<string>("");
  const [theme, setTheme] = useState<string>("");
  const [count, setCount] = useState<number>(1);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<QuestionSuggestion[] | null>(null);
  const [receivedCount, setReceivedCount] = useState<number | null>(null);
  const [requestedCount, setRequestedCount] = useState<number | null>(null);
  const [partial, setPartial] = useState<boolean>(false);

  const constraintLabel = useMemo(() => {
    const parts: string[] = [];
    if (typeof requestedVisibility === "string") {
      parts.push(requestedVisibility === "public" ? "Öffentlich" : "Privat (Link)");
    }
    if (typeof requestedIsResolvable === "boolean") {
      parts.push(requestedIsResolvable ? "Prognose" : "Meinungs-Umfrage");
    }
    if (typeof requestedAnswerMode === "string") {
      parts.push(requestedAnswerMode === "options" ? "Optionen" : "Ja/Nein");
    }
    return parts.filter(Boolean).join(" · ");
  }, [requestedAnswerMode, requestedIsResolvable, requestedVisibility]);

  const canGenerate = useMemo(() => {
    if (!isAdmin) return false;
    if (mode === "theme") return theme.trim().length >= 6;
    return Boolean(category.trim());
  }, [category, isAdmin, mode, theme]);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    setErrorRaw(null);
    setReceivedCount(null);
    setRequestedCount(null);
    setPartial(false);
    try {
      const basePayload =
        mode === "theme"
          ? { theme: theme.trim(), region: region.trim() || undefined, count }
          : { category: category.trim(), region: region.trim() || undefined, count };

      const payload = {
        ...basePayload,
        isResolvable: typeof requestedIsResolvable === "boolean" ? requestedIsResolvable : undefined,
        answerMode: requestedAnswerMode,
        visibility: requestedVisibility,
      };

      const res = await fetch("/api/admin/question-suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json: any = await res.json().catch(() => null);
      if (!res.ok) {
        setErrorRaw(typeof json?.raw === "string" ? json.raw : null);
        throw new Error(json?.error ?? "KI-Vorschläge konnten nicht geladen werden.");
      }

      const list = Array.isArray(json?.suggestions) ? (json.suggestions as QuestionSuggestion[]) : [];
      if (list.length === 0) throw new Error("Keine Vorschläge erhalten.");

      setSuggestions(list);
      setRequestedCount(typeof json?.requestedCount === "number" ? json.requestedCount : count);
      setReceivedCount(typeof json?.receivedCount === "number" ? json.receivedCount : list.length);
      setPartial(Boolean(json?.partial));
      setOpen(true);
    } catch (e: unknown) {
      setSuggestions(null);
      setError(e instanceof Error ? e.message : "KI-Vorschläge konnten nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [category, count, mode, region, requestedAnswerMode, requestedIsResolvable, requestedVisibility, theme]);

  if (!isAdmin) return null;

  return (
    <section className="rounded-3xl border border-emerald-300/15 bg-emerald-500/5 p-4 shadow-xl shadow-emerald-500/5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">KI-Assistent (Admin)</div>
          <div className="mt-1 text-xs text-slate-300">
            Erst Vorschläge holen, dann ins Formular übernehmen und manuell prüfen. Keine automatische Veröffentlichung.
          </div>
          {constraintLabel ? (
            <div className="mt-1 text-xs text-emerald-100/80">Generiert passend zu: {constraintLabel}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-200/30"
        >
          {open ? "Schließen" : "Öffnen"}
        </button>
      </div>

      {open ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-wrap gap-2">
            <Chip active={mode === "category"} label="Kategorie" onClick={() => setMode("category")} />
            <Chip active={mode === "theme"} label="Thema (Freitext)" onClick={() => setMode("theme")} />
          </div>

          {mode === "category" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">Kategorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                >
                  {categories.map((c) => (
                    <option key={c.label} value={c.label}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-200">Region (optional)</label>
                <input
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  placeholder="z. B. Deutschland, Europa, Stuttgart …"
                  className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-200">Thema/Briefing</label>
              <textarea
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                rows={3}
                placeholder="z. B. EU‑Mercosur Abkommen: aktueller Stand, was muss passieren, bis es in Kraft tritt …"
                className="w-full resize-none rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-slate-200">Region (optional)</label>
                  <input
                    value={region}
                    onChange={(e) => setRegion(e.target.value)}
                    placeholder="z. B. Deutschland, Europa, Global …"
                    className="w-full rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-slate-200">Anzahl Vorschläge</label>
              <select
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
                className="rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-white shadow-inner shadow-black/40 outline-none focus:border-emerald-300"
              >
                {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              disabled={!canGenerate || loading}
              onClick={() => void generate()}
              className="rounded-xl bg-emerald-500/80 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Suche…" : "Vorschläge generieren"}
            </button>
          </div>

          {error ? <div className="text-sm text-rose-200">{error}</div> : null}
          {errorRaw ? (
            <details className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <summary className="cursor-pointer text-xs font-semibold text-slate-200">
                Roh-Antwort anzeigen (Debug)
              </summary>
              <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap break-words text-[11px] text-slate-300">
                {errorRaw}
              </pre>
              <button
                type="button"
                onClick={() => void navigator.clipboard.writeText(errorRaw)}
                className="mt-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-emerald-200/30"
              >
                Kopieren
              </button>
            </details>
          ) : null}

          {suggestions ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Vorschläge{" "}
                  {requestedCount ? (
                    <span className="normal-case text-slate-500">
                      ({suggestions.length}/{requestedCount})
                    </span>
                  ) : null}
                </div>
                {partial ? (
                  <div className="text-xs text-amber-200">
                    Hinweis: Nur {receivedCount ?? suggestions.length} Vorschläge erhalten. Du kannst es erneut versuchen.
                  </div>
                ) : null}
              </div>
              {suggestions.map((s, idx) => (
                <article key={`${s.title}-${idx}`} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100">
                          {s.category}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100">
                          {s.isResolvable !== false ? "Prognose" : "Meinungs-Umfrage"}
                        </span>
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100">
                          {s.answerMode === "options" ? "Optionen" : "Ja/Nein"}
                        </span>
                        {s.region ? (
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100">
                            {s.region}
                          </span>
                        ) : null}
                        <span className="text-[11px] text-slate-400">
                          Review: {s.reviewHours}h · Abstimmung Ende: {formatDateTime(s.pollEndAt)}
                        </span>
                      </div>
                      <h3 className="mt-2 text-base font-semibold text-white">{s.title}</h3>
                      <p className="mt-2 text-sm text-slate-200">{s.description}</p>
                      {s.answerMode === "options" && Array.isArray(s.options) && s.options.length > 0 ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs font-semibold text-slate-100">Optionen</div>
                          <ul className="mt-2 space-y-1 text-xs text-slate-200">
                            {s.options.slice(0, 6).map((opt) => (
                              <li key={opt} className="break-words">
                                - {opt}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      {typeof s.imagePrompt === "string" && s.imagePrompt.trim() ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs font-semibold text-slate-100">Bild-Prompt (KI)</div>
                          <div className="mt-1 text-xs text-slate-300">{s.imagePrompt.trim()}</div>
                        </div>
                      ) : null}

                      {s.isResolvable !== false ? (
                        <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="text-xs font-semibold text-slate-100">Auflösung</div>
                          <div className="mt-1 text-xs text-slate-300">{s.resolutionCriteria}</div>
                          <div className="mt-2 text-xs text-slate-400">
                            Deadline: {formatDateTime(s.resolutionDeadlineAt)}
                          </div>
                          <div className="mt-2 text-xs text-slate-300">
                            Quelle: <span className="break-all">{s.resolutionSource}</span>
                          </div>
                          {s.sources?.length ? (
                            <ul className="mt-2 space-y-1 text-xs text-slate-300">
                              {s.sources.map((url) => (
                                <li key={url} className="break-all">
                                  {url}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => onApply(s)}
                      className="shrink-0 rounded-xl border border-emerald-300/30 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-50 hover:border-emerald-300/60"
                    >
                      Ins Formular übernehmen
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
