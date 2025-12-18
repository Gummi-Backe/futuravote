"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Summary = {
  uniqueSessions7d: number;
  pageViews7d: number;
  votes7d: number;
  draftReviews7d: number;
  shares7d: number;
  copies7d: number;
  logins7d: number;
  registers7d: number;
  sampleLimits?: { uniqueSessions?: number; topPages?: number };
};

type TopPage = { path: string; count: number };
type LatestRow = { event: string; path: string | null; created_at: string; meta: any };

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

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-md shadow-black/20">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

export default function AnalyticsClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [topPages, setTopPages] = useState<TopPage[]>([]);
  const [latest, setLatest] = useState<LatestRow[]>([]);
  const [since7d, setSince7d] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics", { cache: "no-store" });
      const json: any = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Analytics konnten nicht geladen werden.");
      setSummary((json?.summary ?? null) as Summary | null);
      setTopPages((Array.isArray(json?.topPages) ? json.topPages : []) as TopPage[]);
      setLatest((Array.isArray(json?.latest) ? json.latest : []) as LatestRow[]);
      setSince7d(typeof json?.since7d === "string" ? json.since7d : null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analytics konnten nicht geladen werden.");
      setSummary(null);
      setTopPages([]);
      setLatest([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const hint = useMemo(() => {
    if (!since7d) return null;
    return `Zeitraum: letzte 7 Tage (seit ${formatDate(since7d)})`;
  }, [since7d]);

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Analytics</h1>
          <p className="mt-1 text-sm text-slate-300">
            Basis-Kennzahlen, um Nutzung und Engpaesse zu sehen (ohne IP/E-Mail).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin/reports" className="text-sm text-emerald-100 hover:text-emerald-200">
            ← Meldungen
          </Link>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-200/30"
          >
            {loading ? "Lade..." : "Aktualisieren"}
          </button>
        </div>
      </div>

      {hint ? <div className="mt-3 text-xs text-slate-400">{hint}</div> : null}
      {error ? <div className="mt-3 text-sm text-rose-200">{error}</div> : null}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Sessions" value={`${summary?.uniqueSessions7d ?? 0}`} hint="Unique (7 Tage)" />
        <Card label="Page Views" value={`${summary?.pageViews7d ?? 0}`} hint="page_view (7 Tage)" />
        <Card label="Votes" value={`${summary?.votes7d ?? 0}`} hint="Fragen (7 Tage)" />
        <Card label="Draft-Reviews" value={`${summary?.draftReviews7d ?? 0}`} hint="Gute Frage/Ablehnen (7 Tage)" />
        <Card label="Shares" value={`${summary?.shares7d ?? 0}`} hint="native share (7 Tage)" />
        <Card label="Copies" value={`${summary?.copies7d ?? 0}`} hint="Link kopiert (7 Tage)" />
        <Card label="Logins" value={`${summary?.logins7d ?? 0}`} hint="Login (7 Tage)" />
        <Card label="Registrierungen" value={`${summary?.registers7d ?? 0}`} hint="Register (7 Tage)" />
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-semibold text-white">Top Seiten (page_view)</div>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            {topPages.length === 0 ? (
              <div className="text-sm text-slate-400">Noch keine Daten.</div>
            ) : (
              topPages.map((p) => (
                <div key={p.path} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{p.path}</span>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-100">
                    {p.count}
                  </span>
                </div>
              ))
            )}
          </div>
          {summary?.sampleLimits?.topPages ? (
            <div className="mt-3 text-[11px] text-slate-500">
              Hinweis: Top-Seiten basieren auf max. {summary.sampleLimits.topPages} Events.
            </div>
          ) : null}
        </div>

        <div className="rounded-3xl border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-semibold text-white">Letzte Events</div>
          <div className="mt-3 space-y-2">
            {latest.length === 0 ? (
              <div className="text-sm text-slate-400">Noch keine Daten.</div>
            ) : (
              latest.map((e, idx) => (
                <div key={`${e.created_at}-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-semibold text-slate-100">
                        {e.event}
                      </span>
                      <span className="text-[11px] text-slate-400">{formatDate(e.created_at)}</span>
                    </div>
                    <div className="mt-1 min-w-0 truncate text-slate-200">{e.path ?? "-"}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

