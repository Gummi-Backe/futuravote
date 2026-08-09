"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { isRecord } from "@/app/lib/unknownValue";

type Summary = {
  uniqueSessions7d: number;
  uniqueSessions30d?: number;
  pageViews7d: number;
  votes7d: number;
  draftReviews7d: number;
  shares7d: number;
  copies7d: number;
  logins7d: number;
  registers7d: number;
  referralVisits7d?: number;
  referralVotes7d?: number;
  sharesAndCopies7d?: number;
  shareToVisitPct?: number;
  visitToVotePct?: number;
  shareToVotePct?: number;
  sampleLimits?: { uniqueSessions?: number; topPages?: number };
};

type TopPage = { path: string; count: number };
type LatestRow = { event: string; path: string | null; created_at: string; meta: unknown };
type Kpis = {
  growth?: { wau: number; mau: number; wauMauRatioPct: number };
  referral?: {
    sharesAndCopies7d: number;
    referralVisits7d: number;
    referralVotes7d: number;
    shareToVisitPct: number;
    visitToVotePct: number;
    shareToVotePct: number;
  };
  topSharers?: { userId: string; displayName: string; conversions: number }[];
};

type Funnel14d = {
  trackingStartedAt: string;
  sampleLimit?: number;
  stages: {
    homeSessions: number;
    feedImpressions: number;
    questionOpens: number;
    voteStarts: number;
    voters: number;
    sharePromptViews: number;
    sharers: number;
    registrations: number;
  };
  conversions: {
    homeToFeedPct: number;
    feedToQuestionOpenPct: number;
    feedToVoteStartPct: number;
    voteStartToVotePct: number;
    voteToSharePromptPct: number;
    sharePromptToSharePct: number;
    homeToRegisterPct: number;
  };
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
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [funnel14d, setFunnel14d] = useState<Funnel14d | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/analytics", { cache: "no-store" });
      const parsed: unknown = await res.json().catch(() => null);
      const json = isRecord(parsed) ? parsed : {};
      if (!res.ok) {
        throw new Error(typeof json.error === "string" ? json.error : "Analytics konnten nicht geladen werden.");
      }
      setSummary((json.summary ?? null) as Summary | null);
      setKpis((json.kpis ?? null) as Kpis | null);
      setFunnel14d((json.funnel14d ?? null) as Funnel14d | null);
      setTopPages((Array.isArray(json.topPages) ? json.topPages : []) as TopPage[]);
      setLatest((Array.isArray(json.latest) ? json.latest : []) as LatestRow[]);
      setSince7d(typeof json.since7d === "string" ? json.since7d : null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Analytics konnten nicht geladen werden.");
      setSummary(null);
      setKpis(null);
      setFunnel14d(null);
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
          <Link href="/admin" className="text-sm text-emerald-100 hover:text-emerald-200">
            Admin
          </Link>
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
        <Card label="MAU (Proxy)" value={`${summary?.uniqueSessions30d ?? 0}`} hint="Unique Sessions (30 Tage)" />
        <Card label="Page Views" value={`${summary?.pageViews7d ?? 0}`} hint="page_view (7 Tage)" />
        <Card label="Votes" value={`${summary?.votes7d ?? 0}`} hint="Fragen (7 Tage)" />
        <Card label="Draft-Reviews" value={`${summary?.draftReviews7d ?? 0}`} hint="Gute Frage/Ablehnen (7 Tage)" />
        <Card label="Shares" value={`${summary?.shares7d ?? 0}`} hint="native share (7 Tage)" />
        <Card label="Copies" value={`${summary?.copies7d ?? 0}`} hint="Link kopiert (7 Tage)" />
        <Card label="Referral Visits" value={`${summary?.referralVisits7d ?? 0}`} hint="Share-Link geöffnet (7 Tage)" />
        <Card label="Referral Votes" value={`${summary?.referralVotes7d ?? 0}`} hint="Vote nach Share-Link (7 Tage)" />
        <Card label="Logins" value={`${summary?.logins7d ?? 0}`} hint="Login (7 Tage)" />
        <Card label="Registrierungen" value={`${summary?.registers7d ?? 0}`} hint="Register (7 Tage)" />
      </div>

      <section className="mt-8 border-y border-white/10 py-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">14-Tage-Kernfunnel</h2>
            <p className="mt-1 text-xs text-slate-400">
              Unique Sessions je Schritt. Die neuen Zwischenstufen werden seit dem 09.08.2026 erfasst.
            </p>
          </div>
          {funnel14d?.sampleLimit ? (
            <span className="text-[11px] text-slate-500">Maximal {funnel14d.sampleLimit} Events</span>
          ) : null}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Startseite" value={`${funnel14d?.stages.homeSessions ?? 0}`} hint="Startseiten-Sessions" />
          <Card label="Umfrage gesehen" value={`${funnel14d?.stages.feedImpressions ?? 0}`} hint="erste Karte im Sichtbereich" />
          <Card label="Details geöffnet" value={`${funnel14d?.stages.questionOpens ?? 0}`} hint="aus dem Feed" />
          <Card label="Stimme begonnen" value={`${funnel14d?.stages.voteStarts ?? 0}`} hint="Antwort ausgewählt" />
          <Card label="Abgestimmt" value={`${funnel14d?.stages.voters ?? 0}`} hint="erfolgreiche Stimmen" />
          <Card label="Share-Aufruf gesehen" value={`${funnel14d?.stages.sharePromptViews ?? 0}`} hint="nach erfolgreicher Stimme" />
          <Card label="Geteilt" value={`${funnel14d?.stages.sharers ?? 0}`} hint="Share oder Kopie" />
          <Card label="Registriert" value={`${funnel14d?.stages.registrations ?? 0}`} hint="Registrierungen" />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card label="Start → Umfrage" value={`${funnel14d?.conversions.homeToFeedPct ?? 0}%`} />
          <Card label="Umfrage → Details" value={`${funnel14d?.conversions.feedToQuestionOpenPct ?? 0}%`} />
          <Card label="Umfrage → Stimmversuch" value={`${funnel14d?.conversions.feedToVoteStartPct ?? 0}%`} />
          <Card label="Stimmversuch → Stimme" value={`${funnel14d?.conversions.voteStartToVotePct ?? 0}%`} />
          <Card label="Stimme → Share-Aufruf" value={`${funnel14d?.conversions.voteToSharePromptPct ?? 0}%`} />
          <Card label="Share-Aufruf → Share" value={`${funnel14d?.conversions.sharePromptToSharePct ?? 0}%`} />
          <Card label="Start → Registrierung" value={`${funnel14d?.conversions.homeToRegisterPct ?? 0}%`} />
        </div>
      </section>

      <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-4">
        <div className="text-sm font-semibold text-white">KPI-Board (Growth & Viral)</div>
        <div className="mt-1 text-xs text-slate-400">
          Share→Visit, Visit→Vote, Share→Vote und WAU/MAU-Ratio als laufender Trend-Check.
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="Share → Visit" value={`${kpis?.referral?.shareToVisitPct ?? 0}%`} hint="referral_visit / (share+copy)" />
          <Card label="Visit → Vote" value={`${kpis?.referral?.visitToVotePct ?? 0}%`} hint="referral_vote / referral_visit" />
          <Card label="Share → Vote" value={`${kpis?.referral?.shareToVotePct ?? 0}%`} hint="referral_vote / (share+copy)" />
          <Card label="WAU/MAU" value={`${kpis?.growth?.wauMauRatioPct ?? 0}%`} hint="7T Unique / 30T Unique" />
        </div>

        <div className="mt-6">
          <div className="text-sm font-semibold text-white">Top Sharer (Conversions, 7 Tage)</div>
          <div className="mt-3 space-y-2 text-sm text-slate-200">
            {(kpis?.topSharers ?? []).length === 0 ? (
              <div className="text-sm text-slate-400">Noch keine Referral-Conversions.</div>
            ) : (
              (kpis?.topSharers ?? []).map((row) => (
                <div key={row.userId} className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate">{row.displayName}</span>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-100">
                    {row.conversions}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
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
