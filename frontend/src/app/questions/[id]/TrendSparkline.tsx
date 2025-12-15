"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Chart, type ChartDataset } from "chart.js/auto";

type Metric = "total" | "split" | "yesPct" | "views" | "ranking";

type TrendPoint = {
  date: string; // YYYY-MM-DD
  yes: number;
  no: number;
  total: number;
  views?: number | null;
  rankingScore?: number | null;
};

type TrendResponse = {
  questionId: string;
  days: number;
  startDate: string;
  source?: "snapshots" | "votes";
  points: TrendPoint[];
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function parseUtcDay(day: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed);
}

function formatShortDay(day: string): string {
  const date = parseUtcDay(day);
  if (!date) return day;
  return date.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export function TrendSparkline({ questionId }: { questionId: string }) {
  const [metric, setMetric] = useState<Metric>("total");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartRef = useRef<Chart | null>(null);

  const chipBase =
    "inline-flex min-w-fit shrink-0 items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 snap-center transition hover:-translate-y-0.5";
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

  const labels = useMemo(() => points.map((p) => formatShortDay(p.date)), [points]);

  const totals = useMemo(() => points.map((p) => p.total), [points]);
  const yesSeries = useMemo(() => points.map((p) => p.yes), [points]);
  const noSeries = useMemo(() => points.map((p) => p.no), [points]);
  const viewsSeries = useMemo(() => {
    let last = 0;
    return points.map((p) => {
      const value = typeof p.views === "number" ? p.views : null;
      if (value === null) return last;
      last = value;
      return value;
    });
  }, [points]);
  const rankingSeries = useMemo(() => {
    let last = 0;
    return points.map((p) => {
      const value = typeof p.rankingScore === "number" ? p.rankingScore : null;
      if (value === null) return last;
      last = value;
      return value;
    });
  }, [points]);
  const yesPctSeries = useMemo(() => {
    let yesAcc = 0;
    let totalAcc = 0;
    return points.map((p) => {
      yesAcc += p.yes;
      totalAcc += p.total;
      return totalAcc > 0 ? Math.round((yesAcc / totalAcc) * 100) : 0;
    });
  }, [points]);

  const cumulative = (values: number[]) => {
    let acc = 0;
    return values.map((v) => {
      acc += v;
      return acc;
    });
  };

  const totalsCum = useMemo(() => cumulative(totals), [totals]);
  const yesCum = useMemo(() => cumulative(yesSeries), [yesSeries]);
  const noCum = useMemo(() => cumulative(noSeries), [noSeries]);

  const totalSum = totalsCum.length > 0 ? totalsCum[totalsCum.length - 1] : 0;
  const yesSum = yesCum.length > 0 ? yesCum[yesCum.length - 1] : 0;
  const noSum = noCum.length > 0 ? noCum[noCum.length - 1] : 0;
  const yesPct = totalSum > 0 ? Math.round((yesSum / Math.max(1, totalSum)) * 100) : 0;
  const viewsLast = viewsSeries.length > 0 ? viewsSeries[viewsSeries.length - 1] : 0;
  const rankingLast = rankingSeries.length > 0 ? rankingSeries[rankingSeries.length - 1] : 0;

  const headerLabel =
    metric === "total"
      ? `Stimmen (${totalSum})`
      : metric === "split"
        ? `Ja/Nein (${yesSum}/${noSum})`
        : metric === "yesPct"
          ? `Ja-Quote (${clamp(yesPct, 0, 100)}%)`
          : metric === "views"
            ? `Views (${viewsLast})`
            : `Ranking (${rankingLast.toFixed(2)})`;

  const datasets = useMemo(() => {
    const base: Partial<ChartDataset<"line">> = {
      type: "line",
      tension: 0.35,
      borderWidth: 2,
      pointRadius: 3,
      pointHoverRadius: 5,
      pointBorderWidth: 0,
      fill: false,
    };

    if (metric === "split") {
      return [
        {
          ...base,
          label: "Ja",
          data: yesCum,
          borderColor: "rgba(52, 211, 153, 0.95)",
          backgroundColor: "rgba(52, 211, 153, 0.95)",
        },
        {
          ...base,
          label: "Nein",
          data: noCum,
          borderColor: "rgba(248, 113, 113, 0.9)",
          backgroundColor: "rgba(248, 113, 113, 0.9)",
        },
      ] satisfies ChartDataset<"line">[];
    }

    if (metric === "yesPct") {
      return [
        {
          ...base,
          label: "Ja-Quote",
          data: yesPctSeries,
          borderColor: "rgba(59, 130, 246, 0.9)",
          backgroundColor: "rgba(59, 130, 246, 0.9)",
        },
      ] satisfies ChartDataset<"line">[];
    }

    if (metric === "views") {
      return [
        {
          ...base,
          label: "Views",
          data: viewsSeries,
          borderColor: "rgba(147, 197, 253, 0.9)",
          backgroundColor: "rgba(147, 197, 253, 0.9)",
        },
      ] satisfies ChartDataset<"line">[];
    }

    if (metric === "ranking") {
      return [
        {
          ...base,
          label: "Ranking",
          data: rankingSeries,
          borderColor: "rgba(250, 204, 21, 0.9)",
          backgroundColor: "rgba(250, 204, 21, 0.9)",
        },
      ] satisfies ChartDataset<"line">[];
    }

    return [
      {
        ...base,
        label: "Stimmen",
        data: totalsCum,
        borderColor: "rgba(52, 211, 153, 0.95)",
        backgroundColor: "rgba(52, 211, 153, 0.95)",
      },
    ] satisfies ChartDataset<"line">[];
  }, [metric, noCum, rankingSeries, totalsCum, viewsSeries, yesCum, yesPctSeries]);

  const yMaxValue = useMemo(() => {
    const all: number[] = [];
    for (const ds of datasets) {
      for (const v of ds.data as number[]) {
        if (typeof v === "number" && Number.isFinite(v)) all.push(v);
      }
    }
    return all.length > 0 ? Math.max(...all) : 0;
  }, [datasets]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }

    if (loading || error || totalSum === 0 || labels.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    chartRef.current = new Chart(ctx, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: { display: false },
          tooltip: {
            mode: "index",
            intersect: false,
            backgroundColor: "rgba(15, 23, 42, 0.92)",
            borderColor: "rgba(255,255,255,0.12)",
            borderWidth: 1,
            titleColor: "rgba(226,232,240,1)",
            bodyColor: "rgba(226,232,240,0.92)",
            displayColors: metric === "split",
            callbacks: {
              label: (ctx) => {
                const label = ctx.dataset.label ? `${ctx.dataset.label}: ` : "";
                const raw = typeof ctx.parsed.y === "number" ? ctx.parsed.y : 0;
                if (metric === "yesPct") return `${label}${clamp(Math.round(raw), 0, 100)}%`;
                if (metric === "ranking") return `${label}${raw.toFixed(2)}`;
                return `${label}${Math.round(raw)}`;
              },
            },
          },
        },
        interaction: { mode: "index", intersect: false },
        scales: {
          x: {
            grid: { color: "rgba(255,255,255,0.10)" },
            ticks: { color: "rgba(148,163,184,0.95)", maxTicksLimit: 3 },
            border: { color: "rgba(255,255,255,0.12)" },
          },
          y: {
            beginAtZero: metric !== "ranking",
            min: metric === "yesPct" ? 0 : undefined,
            max: metric === "yesPct" ? 100 : undefined,
            grid: { color: "rgba(255,255,255,0.10)" },
            border: { color: "rgba(255,255,255,0.12)" },
            ticks: {
              color: "rgba(148,163,184,0.95)",
              precision: metric === "ranking" ? 2 : 0,
              stepSize:
                metric === "yesPct"
                  ? 10
                  : metric === "ranking"
                    ? undefined
                    : yMaxValue <= 20
                      ? 1
                      : undefined,
              callback: (value) => {
                const num = typeof value === "number" ? value : Number(value);
                if (metric === "yesPct") return `${clamp(Math.round(num), 0, 100)}%`;
                if (metric === "ranking") return num.toFixed(2);
                return String(Math.round(num));
              },
            },
          },
        },
      },
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [datasets, error, labels, loading, metric, totalSum, yMaxValue]);

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-white">Trend</span>
        <span className="text-[11px] text-slate-400">{headerLabel}</span>
      </div>

      <div className="flex min-h-[140px] w-full flex-col justify-center overflow-hidden rounded-xl border border-white/10 bg-black/20 p-3">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-[11px] text-slate-400">Lädt...</div>
        ) : error ? (
          <div className="flex flex-1 items-center justify-center text-[11px] text-rose-200">{error}</div>
        ) : totalSum === 0 ? (
          <div className="flex flex-1 items-center justify-center text-[11px] text-slate-400">
            Noch keine Trenddaten
          </div>
        ) : (
          <div className="min-h-[120px] flex-1">
            <canvas ref={canvasRef} className="h-full w-full" />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex min-w-0 gap-2 overflow-x-auto overflow-y-hidden py-1 text-sm text-slate-100 snap-x snap-mandatory">
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
          <button
            type="button"
            onClick={() => setMetric("views")}
            className={`${chipBase} ${metric === "views" ? chipActive : chipInactive}`}
          >
            Views
          </button>
          <button
            type="button"
            onClick={() => setMetric("ranking")}
            className={`${chipBase} ${metric === "ranking" ? chipActive : chipInactive}`}
          >
            Ranking
          </button>
        </div>

        <div className="flex min-w-0 gap-2 overflow-x-auto overflow-y-hidden py-1 text-sm text-slate-100 snap-x snap-mandatory">
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
    </div>
  );
}
