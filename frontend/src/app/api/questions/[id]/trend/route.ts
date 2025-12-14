import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

type VoteRow = { choice: "yes" | "no"; created_at: string };
type MetricRow = {
  day: string; // YYYY-MM-DD
  yes_votes: number;
  no_votes: number;
  views: number | null;
  ranking_score: number | null;
};

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

  // Etappe 2: bevorzugt Snapshot-Tabelle (skalierbar), fallback auf Roh-Votes wenn nicht vorhanden.
  const { data: metricsData, error: metricsError } = await supabase
    .from("question_metrics_daily")
    .select("day, yes_votes, no_votes, views, ranking_score")
    .eq("question_id", id)
    .gte("day", startDay)
    .lte("day", todayDay)
    .order("day", { ascending: true });

  if (!metricsError && Array.isArray(metricsData) && metricsData.length > 0) {
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

    return NextResponse.json({ questionId: id, days, startDate: startDay, source: "snapshots", points });
  }

  const { data, error } = await supabase
    .from("votes")
    .select("choice, created_at")
    .eq("question_id", id)
    .gte("created_at", startIso)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Trend query failed", error);
    return NextResponse.json({ error: "Trend konnte nicht geladen werden." }, { status: 500 });
  }

  const byDate = new Map<string, { yes: number; no: number }>();
  for (const row of ((data as VoteRow[]) ?? [])) {
    if (!row?.created_at) continue;
    const key = dateKeyUtc(row.created_at);
    const current = byDate.get(key) ?? { yes: 0, no: 0 };
    if (row.choice === "yes") current.yes += 1;
    else if (row.choice === "no") current.no += 1;
    byDate.set(key, current);
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
    const counts = byDate.get(key) ?? { yes: 0, no: 0 };
    points.push({
      date: key,
      yes: counts.yes,
      no: counts.no,
      total: counts.yes + counts.no,
      views: null,
      rankingScore: null,
    });
  }

  if (metricsError) {
    console.warn("Trend snapshots unavailable; fallback to votes:", metricsError);
  }

  return NextResponse.json({ questionId: id, days, startDate: startDay, source: "votes", points });
}
