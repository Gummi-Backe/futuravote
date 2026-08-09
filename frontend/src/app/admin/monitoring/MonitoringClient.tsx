"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type LastEvent = { createdAt: string | null; meta: any | null };

type MonitoringPayload = {
  ok: true;
  nowUtc: string;
  since24hUtc: string;
  crons: {
    resolutionSuggestions: LastEvent;
    questionMetrics: LastEvent;
    creatorNotifications: LastEvent;
    privatePollResults: LastEvent;
    privatePollReminders: LastEvent;
  };
  rateLimits24h: { votes429: number; comments429: number };
};

function formatDate(value: string | null) {
  if (!value) return "–";
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

function okFromMeta(meta: any | null): boolean | null {
  const ok = meta?.ok;
  return typeof ok === "boolean" ? ok : null;
}

type HealthStatus = "ok" | "warn" | "critical" | "unknown";

function Pill({ status }: { status: HealthStatus }) {
  const cls =
    status === "ok"
      ? "border-emerald-300/30 bg-emerald-500/15 text-emerald-50"
      : status === "warn"
        ? "border-amber-300/30 bg-amber-500/15 text-amber-50"
        : status === "critical"
          ? "border-rose-300/40 bg-rose-500/20 text-rose-50"
        : "border-white/10 bg-white/5 text-slate-200";
  const label = status === "ok" ? "OK" : status === "warn" ? "Veraltet" : status === "critical" ? "Kritisch" : "–";
  return <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

function SmallCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-md shadow-black/20">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
      {hint ? <div className="mt-1 text-xs text-slate-400">{hint}</div> : null}
    </div>
  );
}

function CronRow({
  title,
  last,
  onRun,
  runLabel,
  nowUtc,
}: {
  title: string;
  last: LastEvent;
  onRun?: () => void;
  runLabel?: string;
  nowUtc?: string | null;
}) {
  const { status, ageHours } = useMemo(() => {
    if (!last.createdAt) return { status: "unknown" as const, ageHours: null };
    const createdMs = Date.parse(last.createdAt);
    if (!Number.isFinite(createdMs)) return { status: "unknown" as const, ageHours: null };
    const referenceMs = nowUtc ? Date.parse(nowUtc) : Number.NaN;
    if (!Number.isFinite(referenceMs)) return { status: "unknown" as const, ageHours: null };
    const age = Math.max(0, (referenceMs - createdMs) / (60 * 60 * 1000));
    const ok = okFromMeta(last.meta);
    if (ok === false || age >= 48) return { status: "critical" as const, ageHours: age };
    if (age >= 26) return { status: "warn" as const, ageHours: age };
    if (ok === true) return { status: "ok" as const, ageHours: age };
    return { status: "unknown" as const, ageHours: age };
  }, [last.createdAt, last.meta, nowUtc]);

  const detail = useMemo(() => {
    const meta = last.meta;
    if (!meta) return null;
    if (typeof meta.sent === "number") return `sent: ${meta.sent}`;
    if (typeof meta.created === "number") return `created: ${meta.created}`;
    if (typeof meta.result?.snapshotRowsUpserted === "number") return `snapshots: ${meta.result.snapshotRowsUpserted}`;
    return null;
  }, [last.meta]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <div className="text-sm font-semibold text-white">{title}</div>
          <Pill status={status} />
        </div>
        <div className="mt-1 text-xs text-slate-400">
          Letzter Lauf: {formatDate(last.createdAt)}
          {typeof ageHours === "number" ? ` · vor ${Math.round(ageHours)} Std.` : ""}
          {detail ? ` · ${detail}` : ""}
        </div>
      </div>
      {onRun ? (
        <button
          type="button"
          onClick={onRun}
          className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-200/30"
        >
          {runLabel ?? "Jetzt ausführen"}
        </button>
      ) : null}
    </div>
  );
}

export default function MonitoringClient() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<MonitoringPayload | null>(null);
  const [runBusy, setRunBusy] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/monitoring", { cache: "no-store" });
      const json: any = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Monitoring konnte nicht geladen werden.");
      setData(json as MonitoringPayload);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Monitoring konnte nicht geladen werden.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const runResolutionCron = useCallback(async () => {
    setRunBusy("resolution");
    setError(null);
    try {
      const res = await fetch("/api/admin/cron/resolution-suggestions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ limit: 25 }),
      });
      const json: any = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Cron konnte nicht ausgeführt werden.");
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cron konnte nicht ausgeführt werden.");
    } finally {
      setRunBusy(null);
    }
  }, [fetchData]);

  const runMetricsCron = useCallback(async () => {
    setRunBusy("metrics");
    setError(null);
    try {
      const res = await fetch("/api/admin/cron/question-metrics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ daysBack: 120 }),
      });
      const json: any = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error ?? "Cron konnte nicht ausgeführt werden.");
      await fetchData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Cron konnte nicht ausgeführt werden.");
    } finally {
      setRunBusy(null);
    }
  }, [fetchData]);

  return (
    <section>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-white">Monitoring</h1>
          <p className="mt-1 text-sm text-slate-300">
            Schnelle Signale, ob Cron-Jobs laufen und ob es auffällige Rate-Limits gibt.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin" className="text-sm text-emerald-100 hover:text-emerald-200">
            Admin
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

      {error ? <div className="mt-3 text-sm text-rose-200">{error}</div> : null}

      <details className="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
        <summary className="cursor-pointer select-none text-sm font-semibold text-white">
          Was bedeutet das alles?
        </summary>
        <div className="mt-3 space-y-3 text-sm text-slate-200">
          <div className="text-slate-300">
            Diese Seite ist ein kleines Frühwarnsystem für Betrieb & Sicherheit (Abuse). Sie zeigt keine IPs oder
            E‑Mails an – nur interne Zähler aus <span className="font-semibold text-slate-200">analytics_events</span>.
          </div>

          <div>
            <div className="text-sm font-semibold text-white">Rate-Limits (Security/Abuse)</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
              <li>
                <span className="font-semibold text-slate-200">Vote 429</span>: Wie oft Nutzer in den letzten 24h beim
                Abstimmen gebremst wurden (zu schnell geklickt/spam).
              </li>
              <li>
                <span className="font-semibold text-slate-200">Kommentar 429</span>: Wie oft Kommentar‑Spam gebremst
                wurde.
              </li>
              <li>
                Wenn diese Werte plötzlich stark steigen, ist das oft ein Hinweis auf ungewöhnliches Verhalten (Bots,
                Skripte) oder zu aggressive Limits.
              </li>
            </ul>
          </div>

          <div>
            <div className="text-sm font-semibold text-white">Cron Jobs (Betrieb)</div>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-slate-300">
              <li>
                <span className="font-semibold text-slate-200">Letzter Lauf</span>: Wann der Job zuletzt gelaufen ist.
              </li>
              <li>
                <span className="font-semibold text-slate-200">OK</span>: Der letzte Lauf wurde als erfolgreich geloggt.
              </li>
              <li>
                <span className="font-semibold text-slate-200">–</span>: Es gibt noch keinen Log‑Eintrag (Job lief noch
                nicht oder Logs wurden noch nicht geschrieben).
              </li>
              <li>
                <span className="font-semibold text-slate-200">Jetzt ausführen</span> (Admin): Startet den Job sofort,
                um ihn zu testen oder Daten zu aktualisieren.
              </li>
            </ul>
          </div>

          <div className="text-[11px] text-slate-500">
            Tipp: Für Details und Fehlersuche sind Vercel Runtime Logs und Supabase Logs weiterhin die beste Quelle.
          </div>
        </div>
      </details>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SmallCard label="Vote 429" value={`${data?.rateLimits24h.votes429 ?? 0}`} hint="letzte 24h" />
        <SmallCard label="Kommentar 429" value={`${data?.rateLimits24h.comments429 ?? 0}`} hint="letzte 24h" />
        <SmallCard label="Monitoring Stand" value={data ? "Aktiv" : "–"} hint={data ? `UTC: ${formatDate(data.nowUtc)}` : ""} />
        <SmallCard label="Fenster" value="24h" hint={data ? `seit ${formatDate(data.since24hUtc)}` : ""} />
      </div>

      <div className="mt-8 rounded-3xl border border-white/10 bg-black/20 p-4">
        <div className="text-sm font-semibold text-white">Cron Jobs</div>
        <div className="mt-3 space-y-2">
          <CronRow
            title="Auflösungs-Vorschläge"
            last={data?.crons.resolutionSuggestions ?? { createdAt: null, meta: null }}
            nowUtc={data?.nowUtc}
            onRun={runBusy ? undefined : () => void runResolutionCron()}
            runLabel={runBusy === "resolution" ? "Läuft..." : "Jetzt ausführen"}
          />
          <CronRow
            title="Trend-Snapshots (Fragen)"
            last={data?.crons.questionMetrics ?? { createdAt: null, meta: null }}
            nowUtc={data?.nowUtc}
            onRun={runBusy ? undefined : () => void runMetricsCron()}
            runLabel={runBusy === "metrics" ? "Läuft..." : "Jetzt ausführen"}
          />
          <CronRow title="Creator-Benachrichtigungen" last={data?.crons.creatorNotifications ?? { createdAt: null, meta: null }} nowUtc={data?.nowUtc} />
          <CronRow title="Private Umfragen: Ergebnis" last={data?.crons.privatePollResults ?? { createdAt: null, meta: null }} nowUtc={data?.nowUtc} />
          <CronRow title="Private Umfragen: Erinnerung" last={data?.crons.privatePollReminders ?? { createdAt: null, meta: null }} nowUtc={data?.nowUtc} />
        </div>

        <div className="mt-4 text-[11px] text-slate-500">
          Hinweis: Diese Seite nutzt nur interne Events (analytics_events). Für Details sind Vercel Runtime Logs und Supabase Logs weiterhin die
          Quelle der Wahrheit.
        </div>
      </div>
    </section>
  );
}
