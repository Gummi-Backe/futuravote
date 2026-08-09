import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { guardGptRateLimit, withCacheHeaders } from "../../_lib";

export const revalidate = 0;

type RecentVoteRow = {
  created_at: string | null;
  question_id: string | null;
  choice: string | null;
  questions:
    | { title: string | null; category: string | null; answer_mode: string | null }
    | Array<{ title: string | null; category: string | null; answer_mode: string | null }>
    | null;
  question_options: { label: string | null } | Array<{ label: string | null }> | null;
};

export async function GET(request: Request) {
  const limited = guardGptRateLimit(request);
  if (limited) return limited;

  const supabase = getSupabaseAdminClient();
  const { searchParams } = new URL(request.url);

  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 5, 1), 20);
  const cursor = searchParams.get("cursor");
  const category = searchParams.get("category");

  let query = supabase
    .from("votes")
    .select(
      "created_at,question_id,choice,option_id, questions!inner(title,category,answer_mode,visibility), question_options(label)"
    )
    .eq("questions.visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category) query = query.eq("questions.category", category);

  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      query = query.lt("created_at", cursorDate.toISOString());
    }
  }

  try {
    const { data: rows } = await query;

    const items = ((rows ?? []) as unknown as RecentVoteRow[]).map((row) => {
      const question = Array.isArray(row.questions) ? row.questions[0] : row.questions;
      const option = Array.isArray(row.question_options) ? row.question_options[0] : row.question_options;
      return {
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
        questionId: typeof row.question_id === "string" ? row.question_id : null,
        questionTitle: typeof question?.title === "string" ? question.title : null,
        category: typeof question?.category === "string" ? question.category : null,
        answerMode: typeof question?.answer_mode === "string" ? question.answer_mode : null,
        choice: typeof row.choice === "string" ? row.choice : null,
        optionLabel: typeof option?.label === "string" ? option.label : null,
      };
    });

    const nextCursor =
      items.length > 0 && items[items.length - 1]?.createdAt ? String(items[items.length - 1].createdAt) : null;

    return withCacheHeaders(NextResponse.json({ items, nextCursor }), 5);
  } catch (error) {
    console.warn("/api/gpt/votes/recent failed", error);
    return withCacheHeaders(NextResponse.json({ items: [], nextCursor: null, error: "temporarily_unavailable" }), 3);
  }
}
