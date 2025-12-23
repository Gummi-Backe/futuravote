import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 30;

type ResolvedQuestionRow = {
  id: string;
  answer_mode: "binary" | "options" | null;
  resolved_outcome: "yes" | "no" | null;
  resolved_option_id: string | null;
};

type VoteRow = {
  user_id: string | null;
  question_id: string;
  choice: "yes" | "no" | null;
  option_id: string | null;
};

type UserRow = {
  id: string;
  display_name: string;
};

function clampInt(value: string | null, fallback: number, min: number, max: number) {
  const n = value ? Number(value) : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function pointsTier(pointsTotal: number): "none" | "bronze" | "silver" | "gold" {
  if (pointsTotal >= 200) return "gold";
  if (pointsTotal >= 50) return "silver";
  if (pointsTotal >= 10) return "bronze";
  return "none";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const days = clampInt(url.searchParams.get("days"), 90, 7, 365);
  const category = (url.searchParams.get("category") ?? "all").trim() || "all";
  const minSamples = clampInt(url.searchParams.get("minSamples"), 5, 1, 100);
  const limit = clampInt(url.searchParams.get("limit"), 25, 1, 100);

  const supabase = getSupabaseAdminClient();
  const startIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let resolvedQuery = supabase
    .from("questions")
    .select("id,answer_mode,resolved_outcome,resolved_option_id")
    .eq("visibility", "public")
    .or("resolved_outcome.not.is.null,resolved_option_id.not.is.null")
    .gte("resolved_at", startIso)
    .limit(5000);

  if (category !== "all") {
    resolvedQuery = resolvedQuery.eq("category", category);
  }

  const { data: resolvedRows, error: resolvedError } = await resolvedQuery;
  if (resolvedError) {
    return NextResponse.json({ ok: false, error: resolvedError.message }, { status: 500 });
  }

  const resolved = (resolvedRows ?? []) as ResolvedQuestionRow[];
  const resolvedByQuestionId = new Map<
    string,
    { mode: "binary"; outcome: "yes" | "no" } | { mode: "options"; optionId: string }
  >();
  resolved.forEach((q) => {
    if (!q?.id) return;
    const mode: "binary" | "options" = q.answer_mode === "options" ? "options" : "binary";
    if (mode === "binary") {
      if (q.resolved_outcome === "yes" || q.resolved_outcome === "no") {
        resolvedByQuestionId.set(q.id, { mode, outcome: q.resolved_outcome });
      }
    } else {
      if (q.resolved_option_id) {
        resolvedByQuestionId.set(q.id, { mode, optionId: q.resolved_option_id });
      }
    }
  });

  const questionIds = Array.from(resolvedByQuestionId.keys());
  if (questionIds.length === 0) {
    return NextResponse.json({ ok: true, days, category, minSamples, leaders: [] });
  }

  const statsByUser = new Map<string, { total: number; correct: number; incorrect: number }>();
  const chunkSize = 200;
    for (let i = 0; i < questionIds.length; i += chunkSize) {
      const chunk = questionIds.slice(i, i + chunkSize);
      const { data: voteRows, error: voteError } = await supabase
        .from("votes")
        .select("user_id,question_id,choice,option_id")
        .in("question_id", chunk)
        .not("user_id", "is", null)
        .limit(20000);

    if (voteError) {
      return NextResponse.json({ ok: false, error: voteError.message }, { status: 500 });
    }

    (voteRows ?? []).forEach((v) => {
      const row = v as VoteRow;
      if (!row.user_id || !row.question_id) return;
      const resolved = resolvedByQuestionId.get(row.question_id);
      if (!resolved) return;

      let isCorrect: boolean | null = null;
      if (resolved.mode === "binary") {
        if (row.choice !== "yes" && row.choice !== "no") return;
        isCorrect = row.choice === resolved.outcome;
      } else {
        if (!row.option_id) return;
        isCorrect = row.option_id === resolved.optionId;
      }
      const cur = statsByUser.get(row.user_id) ?? { total: 0, correct: 0, incorrect: 0 };
      cur.total += 1;
      if (isCorrect) cur.correct += 1;
      else cur.incorrect += 1;
      statsByUser.set(row.user_id, cur);
    });
  }

  const userIds = Array.from(statsByUser.keys());
  const userById = new Map<string, string>();
  for (let i = 0; i < userIds.length; i += 200) {
    const chunk = userIds.slice(i, i + 200);
    const { data: userRows, error: userError } = await supabase.from("users").select("id,display_name").in("id", chunk);
    if (userError) {
      return NextResponse.json({ ok: false, error: userError.message }, { status: 500 });
    }
    ((userRows ?? []) as UserRow[]).forEach((u) => userById.set(u.id, u.display_name));
  }

  const leaders: Array<{
    userId: string;
    displayName: string;
    total: number;
    correct: number;
    incorrect: number;
    accuracyPct: number;
    pointsTotal: number;
    tier: "none" | "bronze" | "silver" | "gold";
  }> = [];

  statsByUser.forEach((s, userId) => {
    if (s.total < minSamples) return;
    const accuracyPct = Math.round((s.correct / s.total) * 100);
    const pointsTotal = Math.max(0, s.correct) * 10;
    leaders.push({
      userId,
      displayName: userById.get(userId) ?? "Anonym",
      total: s.total,
      correct: s.correct,
      incorrect: s.incorrect,
      accuracyPct,
      pointsTotal,
      tier: pointsTier(pointsTotal),
    });
  });

  leaders.sort((a, b) => {
    if (b.correct !== a.correct) return b.correct - a.correct;
    if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
    if (b.total !== a.total) return b.total - a.total;
    return a.displayName.localeCompare(b.displayName, "de");
  });

  return NextResponse.json({ ok: true, days, category, minSamples, leaders: leaders.slice(0, limit) });
}
