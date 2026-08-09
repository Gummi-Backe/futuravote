import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { guardGptRateLimit, withCacheHeaders } from "../../_lib";

export const revalidate = 0;

type RecentReviewRow = {
  created_at: string | null;
  draft_id: string | null;
  choice: string | null;
  drafts:
    | { title: string | null; category: string | null }
    | Array<{ title: string | null; category: string | null }>
    | null;
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
    .from("draft_reviews")
    .select("created_at,choice,draft_id, drafts!inner(title,category,visibility)")
    .eq("drafts.visibility", "public")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (category) query = query.eq("drafts.category", category);

  if (cursor) {
    const cursorDate = new Date(cursor);
    if (!Number.isNaN(cursorDate.getTime())) {
      query = query.lt("created_at", cursorDate.toISOString());
    }
  }

  try {
    const { data: rows } = await query;

    const items = ((rows ?? []) as unknown as RecentReviewRow[]).map((row) => {
      const draft = Array.isArray(row.drafts) ? row.drafts[0] : row.drafts;
      return {
        createdAt: typeof row.created_at === "string" ? row.created_at : null,
        draftId: typeof row.draft_id === "string" ? row.draft_id : null,
        draftTitle: typeof draft?.title === "string" ? draft.title : null,
        category: typeof draft?.category === "string" ? draft.category : null,
        choice: typeof row.choice === "string" ? row.choice : null,
      };
    });

    const nextCursor =
      items.length > 0 && items[items.length - 1]?.createdAt ? String(items[items.length - 1].createdAt) : null;

    return withCacheHeaders(NextResponse.json({ items, nextCursor }), 5);
  } catch (error) {
    console.warn("/api/gpt/reviews/recent failed", error);
    return withCacheHeaders(NextResponse.json({ items: [], nextCursor: null, error: "temporarily_unavailable" }), 3);
  }
}
