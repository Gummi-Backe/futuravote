"use client";

import { useEffect, useMemo, useState } from "react";

type Metric = "total" | "split" | "yesPct";

type TrendPoint = {
  date: string; // YYYY-MM-DD
  yes: number;
  no: number;
  total: number;
};

type TrendResponse = {
  questionId: string;
  days: number;
  startDate: string;
  points: TrendPoint[];
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function polylineForSeries(values: number[]): string {
  if (values.length === 0) return "";
  const width = 100;
  const height = 30;
  const padding = 2;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;

  return values
    .map((value, index) => {
      const x =
        values.length === 1 ? width / 2 : (index / (values.length - 1)) * (width - padding * 2) + padding;
      const normalized = range <= 0 ? 0.5 : (value - min) / range;
      const y = (1 - normalized) * (height - padding * 2) + padding;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

export function TrendSparkline({ questionId }: { questionId: string }) {
  const [metric, setMetric] = useState<Metric>("total");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<TrendPoint[]>([]);

  const chipBase =
    "inline-flex min-w-fit items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5";
  const chipInactive = "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40";
  const chipActive = "border-emerald-300/60 bg-emerald-500/20 text-white";

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    void fetch(`/api/questions/${encodeURIComponent(questionId)}/trend?days=${days}`)
      .then(async (res) => {
        const json = (await res.json().catch(() => null)) as TrendResponse | { error?: string } | null;
        if (!res.ok) {
          throw new Error((json as any)?.error ?? "Trend konnte nicht geladen werden.");
        }
        return json as TrendResponse;
      })
      .then((data) => {
        if (!alive) return;
        setPoints(data?.points ?? []);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Trend konnte nicht geladen werden.");
        setPoints([]);
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [questionId, days]);

  const totals = useMemo(() => points.map((p) => p.total), [points]);
  const yesSeries = useMemo(() => points.map((p) => p.yes), [points]);
  const noSeries = useMemo(() => points.map((p) => p.no), [points]);
  const yesPctSeries = useMemo(
    () => {
      let yesAcc = 0;
      let totalAcc = 0;
      return points.map((p) => {
        yesAcc += p.yes;
        totalAcc += p.total;
        return totalAcc > 0 ? Math.round((yesAcc / totalAcc) * 100) : 0;
      });
    },
    [points]
  );

  const totalSum = totals.reduce((acc, v) => acc + v, 0);
  const yesSum = yesSeries.reduce((acc, v) => acc + v, 0);
  const noSum = noSeries.reduce((acc, v) => acc + v, 0);
  const yesPct = totalSum > 0 ? Math.round((yesSum / Math.max(1, totalSum)) * 100) : 0;

  const headerLabel =
    metric === "total"
      ? `Stimmen (${totalSum})`
      : metric === "split"
        ? `Ja/Nein (${yesSum}/${noSum})`
        : `Ja-Quote (${clamp(yesPct, 0, 100)}%)`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white">Trend</span>
        <span className="text-[11px] text-slate-400">{headerLabel}</span>
      </div>

      <div className="h-16 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2">
        {loading ? (
          <div className="flex h-full items-center justify-center text-[11px] text-slate-400">Laedt...</div>
        ) : error ? (
          <div className="flex h-full items-center justify-center text-[11px] text-rose-200">{error}</div>
        ) : totalSum === 0 ? (
          <div className="flex h-full items-center justify-center text-[11px] text-slate-400">
            Noch keine Trenddaten
          </div>
        ) : (
          <svg viewBox="0 0 100 30" className="h-full w-full" aria-hidden>
            {metric === "total" && (
              <polyline
                fill="none"
                stroke="rgba(52, 211, 153, 0.95)"
                strokeWidth="2"
                points={polylineForSeries(totals)}
              />
            )}
            {metric === "split" && (
              <>
                <polyline
                  fill="none"
                  stroke="rgba(52, 211, 153, 0.95)"
                  strokeWidth="2"
                  points={polylineForSeries(yesSeries)}
                />
                <polyline
                  fill="none"
                  stroke="rgba(248, 113, 113, 0.9)"
                  strokeWidth="2"
                  points={polylineForSeries(noSeries)}
                />
              </>
            )}
            {metric === "yesPct" && (
              <polyline
                fill="none"
                stroke="rgba(59, 130, 246, 0.9)"
                strokeWidth="2"
                points={polylineForSeries(yesPctSeries)}
              />
            )}
          </svg>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMetric("total")}
          className={`${chipBase} ${metric === "total" ? chipActive : chipInactive}`}
        >
          Stimmen
        </button>
        <button
          type="button"
          onClick={() => setMetric("split")}
          className={`${chipBase} ${metric === "split" ? chipActive : chipInactive}`}
        >
          Ja/Nein
        </button>
        <button
          type="button"
          onClick={() => setMetric("yesPct")}
          className={`${chipBase} ${metric === "yesPct" ? chipActive : chipInactive}`}
        >
          Ja-Quote
        </button>
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`${chipBase} ${days === d ? chipActive : chipInactive}`}
          >
            {d}T
          </button>
        ))}
      </div>
    </div>
  );
}
