import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient();

    const [{ data: voteRows }, { data: reviewRows }] = await Promise.all([
      supabase
        .from("votes")
        .select("created_at, questions!inner(visibility)")
        .eq("questions.visibility", "public")
        .order("created_at", { ascending: false })
        .limit(1),
      supabase
        .from("draft_reviews")
        .select("created_at, drafts!inner(visibility)")
        .eq("drafts.visibility", "public")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);

    const lastPublicVoteAt =
      voteRows && voteRows.length > 0 && typeof (voteRows[0] as any)?.created_at === "string"
        ? String((voteRows[0] as any).created_at)
        : null;
    const lastPublicReviewAt =
      reviewRows && reviewRows.length > 0 && typeof (reviewRows[0] as any)?.created_at === "string"
        ? String((reviewRows[0] as any).created_at)
        : null;

    return NextResponse.json({
      lastPublicVoteAt,
      lastPublicReviewAt,
    });
  } catch (error) {
    console.warn("activity summary failed", error);
    return NextResponse.json({
      lastPublicVoteAt: null,
      lastPublicReviewAt: null,
    });
  }
}

