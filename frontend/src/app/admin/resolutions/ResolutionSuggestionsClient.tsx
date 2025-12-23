"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SmartBackButton } from "@/app/components/SmartBackButton";

type Status = "pending" | "applied" | "dismissed" | "failed";

type SuggestionRow = {
  id: string;
  question_id: string;
  source_kind: "ai" | "community";
  created_by_user_id: string | null;
  status: Status;
  suggested_outcome: "yes" | "no" | "unknown";
  suggested_option_id?: string | null;
  confidence: number;
  note: string | null;
  sources: string[] | null;
  model: string | null;
  created_at: string;
  questions?: {
    id: string;
    title: string | null;
    closes_at: string | null;
    share_id: string | null;
    answer_mode?: string | null;
    question_options?: Array<{ id: string; label: string }> | null;
  } | null;
};

function formatDate(value: string) {
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

function outcomeLabel(v: "yes" | "no" | "unknown") {
  if (v === "yes") return "Ja";
  if (v === "no") return "Nein";
  return "Unklar";
}

function outcomePillClass(v: "yes" | "no" | "unknown") {
  if (v === "yes") return "border-emerald-300/40 bg-emerald-500/15 text-emerald-100";
  if (v === "no") return "border-rose-300/40 bg-rose-500/15 text-rose-100";
  return "border-slate-300/30 bg-white/5 text-slate-200";
}

function optionSuggestionLabel(row: SuggestionRow): string | null {
  const optId = row.suggested_option_id ? String(row.suggested_option_id) : "";
  if (!optId) return null;
  const opts = row.questions?.question_options;
  const label = Array.isArray(opts) ? opts.find((o) => o.id === optId)?.label : null;
  return label ? `Option: ${label}` : "Option";
}

function sourceKindLabel(v: "ai" | "community") {
  return v === "community" ? "Community" : "KI";
}

function resolveTargetLink(row: SuggestionRow): string {
  const withFrom = (href: string) => (href.includes("?") ? `${href}&from=admin_resolutions` : `${href}?from=admin_resolutions`);
  const shareId = row.questions?.share_id;
  if (shareId) return withFrom(`/p/${encodeURIComponent(shareId)}`);
  return withFrom(`/questions/${encodeURIComponent(row.question_id)}`);
}

export default function ResolutionSuggestionsClient() {
  const [status, setStatus] = useState<Status>("pending");
  const [rows, setRows] = useState<SuggestionRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchRows = useCallback(async (nextStatus: Status) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/resolution-suggestions?status=${encodeURIComponent(nextStatus)}&limit=200`, {
        cache: "no-store",
      });
      const json = (await res.json().catch(() => null)) as any;
      if (!res.ok) {
        throw new Error(json?.error ?? "Auflösungs-Vorschläge konnten nicht geladen werden.");
      }
      setRows((Array.isArray(json?.suggestions) ? json.suggestions : []) as SuggestionRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auflösungs-Vorschläge konnten nicht geladen werden.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRows(status);
  }, [fetchRows, status]);

  const doAction = useCallback(
    async (id: string, action: "apply" | "dismiss") => {
      setError(null);
      try {
        const res = await fetch("/api/admin/resolution-suggestions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, action }),
        });
        const json = (await res.json().catch(() => null)) as any;
        if (!res.ok) {
          throw new Error(json?.error ?? "Aktion fehlgeschlagen.");
        }
        setRows((prev) => (prev ?? []).filter((r) => r.id !== id));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Aktion fehlgeschlagen.");
      }
    },
    []
  );

  const title = useMemo(() => {
    if (status === "applied") return "Übernommene Vorschläge";
    if (status === "dismissed") return "Verworfene Vorschläge";
    if (status === "failed") return "Fehlgeschlagene Versuche";
    return "Offene Vorschläge";
  }, [status]);

  return (
    <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/10 backdrop-blur">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Auflösungen (Admin)</h1>
          <p className="mt-1 text-sm text-slate-300">
            Täglicher Cron legt KI-Vorschläge an; zusätzlich können Nutzer nach Ende einer Frage das Ergebnis mit Quellen vorschlagen.
          </p>
        </div>
        <SmartBackButton fallbackHref="/admin" label="← Zurück" className="bg-transparent p-0 text-sm text-emerald-100 hover:text-emerald-200" />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {(
          [
            { id: "pending" as const, label: "Offen" },
            { id: "applied" as const, label: "Übernommen" },
            { id: "dismissed" as const, label: "Verworfen" },
            { id: "failed" as const, label: "Fehler" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatus(t.id)}
            className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5 ${
              status === t.id ? "border-emerald-300/60 bg-emerald-500/20 text-white" : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40"
            }`}
          >
            {t.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-slate-300">{loading ? "Lade..." : title}</span>
      </div>

      {error ? <div className="mt-3 text-sm text-rose-200">{error}</div> : null}

      <div className="mt-4 space-y-3">
        {rows === null ? (
          <div className="text-sm text-slate-300">Lade...</div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
            Keine Einträge in dieser Ansicht.
          </div>
        ) : (
          rows.map((r) => {
            const link = resolveTargetLink(r);
            const sources = (r.sources ?? []).filter(Boolean).slice(0, 6);
            const optLabel = optionSuggestionLabel(r);
            return (
              <article key={r.id} className="rounded-3xl border border-white/10 bg-black/20 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${outcomePillClass(r.suggested_outcome)}`}>
                        {sourceKindLabel(r.source_kind)}: {optLabel ?? outcomeLabel(r.suggested_outcome)} ({Math.round(Number(r.confidence ?? 0) || 0)}%)
                      </span>
                      <span className="text-[11px] text-slate-400">{formatDate(r.created_at)}</span>
                      {r.source_kind === "ai" && r.model ? (
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100">
                          {r.model}
                        </span>
                      ) : null}
                    </div>
                    <h3 className="mt-2 card-title-wrap text-sm font-semibold text-white">
                      {r.questions?.title ?? r.question_id}
                    </h3>
                    {r.note ? <p className="mt-2 text-sm text-slate-200">{r.note}</p> : null}

                    {sources.length ? (
                      <div className="mt-3 space-y-1 text-xs text-slate-300">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Quellen</div>
                        <ul className="space-y-1">
                          {sources.map((u) => (
                            <li key={u} className="min-w-0 break-words [overflow-wrap:anywhere]">
                              <a href={u} target="_blank" rel="noreferrer" className="text-emerald-100 hover:text-emerald-200">
                                {u}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                      <Link href={link} className="text-emerald-100 hover:text-emerald-200">
                        Zur Frage
                      </Link>
                    </div>
                  </div>

                  {status === "pending" ? (
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => void doAction(r.id, "dismiss")}
                        className="rounded-xl border border-white/20 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-100 hover:border-emerald-200/40"
                      >
                        Verwerfen
                      </button>
                      <button
                        type="button"
                        onClick={() => void doAction(r.id, "apply")}
                        className="rounded-xl border border-emerald-300/40 bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-50 hover:border-emerald-300/60"
                      >
                        Übernehmen
                      </button>
                    </div>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
