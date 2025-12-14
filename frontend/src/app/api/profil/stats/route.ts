import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const reviewSessionId = cookieStore.get("fv_session")?.value ?? null;
  if (!sessionId) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const user = await getUserBySessionSupabase(sessionId);
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  // Draft-Statistiken (als Ersteller)
  const { count: draftsTotal } = await supabase
    .from("drafts")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id);

  const { count: draftsAccepted } = await supabase
    .from("drafts")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id)
    .eq("status", "accepted");

  const { count: draftsRejected } = await supabase
    .from("drafts")
    .select("id", { count: "exact", head: true })
    .eq("creator_id", user.id)
    .eq("status", "rejected");

  // Frage-Votes (als Waehler)
  const { count: votesTotal } = await supabase
    .from("votes")
    .select("question_id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { count: votesYes } = await supabase
    .from("votes")
    .select("question_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("choice", "yes");

  const { count: votesNo } = await supabase
    .from("votes")
    .select("question_id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("choice", "no");

  const { count: reviewsTotal } = reviewSessionId
    ? await supabase
        .from("draft_reviews")
        .select("id", { count: "exact", head: true })
        .eq("session_id", reviewSessionId)
    : { count: 0 };

  const accepted = draftsAccepted ?? 0;
  const rejected = draftsRejected ?? 0;
  const trustScoreSample = accepted + rejected;
  const trustScorePct = trustScoreSample >= 3 ? Math.round((accepted / trustScoreSample) * 100) : null;

  return NextResponse.json({
    draftsTotal: draftsTotal ?? 0,
    draftsAccepted: draftsAccepted ?? 0,
    draftsRejected: draftsRejected ?? 0,
    votesTotal: votesTotal ?? 0,
    votesYes: votesYes ?? 0,
    votesNo: votesNo ?? 0,
    reviewsTotal: reviewsTotal ?? 0,
    trustScorePct,
    trustScoreSample,
  });
}
