import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

export async function GET(request: Request) {
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

  const { data: rows } = await query;

  const items =
    (rows as any[])?.map((row) => ({
      createdAt: typeof row.created_at === "string" ? row.created_at : null,
      draftId: typeof row.draft_id === "string" ? row.draft_id : null,
      draftTitle: typeof row?.drafts?.title === "string" ? row.drafts.title : null,
      category: typeof row?.drafts?.category === "string" ? row.drafts.category : null,
      choice: typeof row.choice === "string" ? row.choice : null,
    })) ?? [];

  const nextCursor =
    items.length > 0 && items[items.length - 1]?.createdAt ? String(items[items.length - 1].createdAt) : null;

  return NextResponse.json({ items, nextCursor });
}

