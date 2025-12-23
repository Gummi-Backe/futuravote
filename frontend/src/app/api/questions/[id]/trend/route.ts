import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

type QuestionMetaRow = { answer_mode: "binary" | "options" | null };
type VoteRow = { choice: "yes" | "no" | null; option_id: string | null; created_at: string };
type MetricRow = {
  day: string; // YYYY-MM-DD
  yes_votes: number;
  no_votes: number;
  views: number | null;
  ranking_score: number | null;
};

type OptionRow = { id: string; label: string; sort_order: number };

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.trunc(value)));
}

function dateKeyUtc(iso: string): string {
  // ISO date: YYYY-MM-DD
  return iso.slice(0, 10);
}

function addUtcDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export async function GET(request: Request, context: Params) {
  const resolvedParams = await context.params;
  const { id } = resolvedParams;

  const url = new URL(request.url);
  const daysRaw = Number(url.searchParams.get("days") ?? "30");
  const days = clampInt(daysRaw, 1, 365);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const start = addUtcDays(today, -(days - 1));
  const startIso = start.toISOString();
  const startDay = dateKeyUtc(startIso);
  const todayDay = dateKeyUtc(today.toISOString());

  const supabase = getSupabaseAdminClient();

  const { data: metaRow } = await supabase.from("questions").select("answer_mode").eq("id", id).maybeSingle();
  const answerMode: "binary" | "options" = (metaRow as QuestionMetaRow | null)?.answer_mode === "options" ? "options" : "binary";

  const { data: optionRows } =
    answerMode === "options"
      ? await supabase
          .from("question_options")
          .select("id,label,sort_order")
          .eq("question_id", id)
          .order("sort_order", { ascending: true })
      : { data: null as any };

  // Etappe 2: bevorzugt Snapshot-Tabelle (skalierbar), fallback auf Roh-Votes wenn nicht vorhanden.
  const { data: metricsData, error: metricsError } = await supabase
    .from("question_metrics_daily")
    .select("day, yes_votes, no_votes, views, ranking_score")
    .eq("question_id", id)
    .gte("day", startDay)
    .lte("day", todayDay)
    .order("day", { ascending: true });

  // Bei Options-Umfragen sind Snapshots fuer Votes aktuell nicht geeignet (yes/no bleiben 0),
  // aber Views/Ranking koennen trotzdem genutzt werden.
  if (answerMode === "binary" && !metricsError && Array.isArray(metricsData) && metricsData.length > 0) {
    const byDate = new Map<string, { yes: number; no: number; views: number | null; rankingScore: number | null }>();
    for (const row of (metricsData as unknown as MetricRow[])) {
      if (!row?.day) continue;
      byDate.set(row.day, {
        yes: Number(row.yes_votes ?? 0),
        no: Number(row.no_votes ?? 0),
        views: row.views ?? null,
        rankingScore: row.ranking_score ?? null,
      });
    }

    const points: Array<{
      date: string;
      yes: number;
      no: number;
      total: number;
      views: number | null;
      rankingScore: number | null;
    }> = [];
    for (let i = 0; i < days; i += 1) {
      const d = addUtcDays(start, i);
      const key = dateKeyUtc(d.toISOString());
      const counts = byDate.get(key) ?? { yes: 0, no: 0, views: null, rankingScore: null };
      points.push({
        date: key,
        yes: counts.yes,
        no: counts.no,
        total: counts.yes + counts.no,
        views: counts.views,
        rankingScore: counts.rankingScore,
      });
    }

    return NextResponse.json({
      questionId: id,
      days,
      startDate: startDay,
      source: "snapshots",
      answerMode: "binary",
      options: null,
      points,
    });
  }

  const { data, error } = await supabase
    .from("votes")
    .select("choice, option_id, created_at")
    .eq("question_id", id)
    .gte("created_at", startIso)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Trend query failed", error);
    return NextResponse.json({ error: "Trend konnte nicht geladen werden." }, { status: 500 });
  }

  const metricsByDate = new Map<string, { views: number | null; rankingScore: number | null }>();
  if (!metricsError && Array.isArray(metricsData) && metricsData.length > 0) {
    for (const row of (metricsData as unknown as MetricRow[])) {
      if (!row?.day) continue;
      metricsByDate.set(row.day, { views: row.views ?? null, rankingScore: row.ranking_score ?? null });
    }
  }

  const byDateBinary = new Map<string, { yes: number; no: number }>();
  const byDateOptions = new Map<string, Map<string, number>>();
  for (const row of ((data as VoteRow[]) ?? [])) {
    if (!row?.created_at) continue;
    const key = dateKeyUtc(row.created_at);
    if (answerMode === "binary") {
      const current = byDateBinary.get(key) ?? { yes: 0, no: 0 };
      if (row.choice === "yes") current.yes += 1;
      else if (row.choice === "no") current.no += 1;
      byDateBinary.set(key, current);
    } else {
      const optId = row.option_id ? String(row.option_id) : "";
      if (!optId) continue;
      const map = byDateOptions.get(key) ?? new Map<string, number>();
      map.set(optId, (map.get(optId) ?? 0) + 1);
      byDateOptions.set(key, map);
    }
  }

  const points: Array<{
    date: string;
    total: number;
    yes?: number;
    no?: number;
    optionCounts?: Record<string, number>;
    views: number | null;
    rankingScore: number | null;
  }> = [];
  for (let i = 0; i < days; i += 1) {
    const d = addUtcDays(start, i);
    const key = dateKeyUtc(d.toISOString());
    const meta = metricsByDate.get(key) ?? { views: null, rankingScore: null };

    if (answerMode === "binary") {
      const counts = byDateBinary.get(key) ?? { yes: 0, no: 0 };
      points.push({
        date: key,
        yes: counts.yes,
        no: counts.no,
        total: counts.yes + counts.no,
        views: meta.views,
        rankingScore: meta.rankingScore,
      });
      continue;
    }

    const map = byDateOptions.get(key) ?? new Map<string, number>();
    const optionCounts: Record<string, number> = {};
    let total = 0;
    map.forEach((count, optionId) => {
      const safe = Math.max(0, Number(count) || 0);
      optionCounts[optionId] = safe;
      total += safe;
    });
    points.push({
      date: key,
      total,
      optionCounts,
      views: meta.views,
      rankingScore: meta.rankingScore,
    });
  }

  if (metricsError) {
    console.warn("Trend snapshots unavailable; fallback to votes:", metricsError);
  }

  const options = answerMode === "options" ? ((optionRows ?? []) as OptionRow[]).map((o) => ({ id: String(o.id), label: String(o.label) })) : null;
  return NextResponse.json({ questionId: id, days, startDate: startDay, source: "votes", answerMode, options, points });
}
