import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

type VoteRow = { choice: "yes" | "no"; created_at: string };

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

  const supabase = getSupabaseAdminClient();
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

  const points: Array<{ date: string; yes: number; no: number; total: number }> = [];
  for (let i = 0; i < days; i += 1) {
    const d = addUtcDays(start, i);
    const key = dateKeyUtc(d.toISOString());
    const counts = byDate.get(key) ?? { yes: 0, no: 0 };
    points.push({ date: key, yes: counts.yes, no: counts.no, total: counts.yes + counts.no });
  }

  return NextResponse.json({ questionId: id, days, startDate: dateKeyUtc(startIso), points });
}

