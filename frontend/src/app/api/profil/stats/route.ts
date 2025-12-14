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

  // Top-Kategorien aus den eigenen Votes (limitiert, damit es auch bei vielen Votes schnell bleibt)
  let topCategories: { category: string; votes: number; yes: number; no: number }[] = [];
  try {
    const { data: voteRows } = await supabase
      .from("votes")
      .select("question_id, choice, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2000);

    const rows = (voteRows ?? []) as { question_id: string; choice: "yes" | "no" }[];
    if (rows.length > 0) {
      const questionIds = Array.from(new Set(rows.map((v) => v.question_id).filter(Boolean)));

      const categoryById = new Map<string, string>();
      const chunkSize = 500;
      for (let i = 0; i < questionIds.length; i += chunkSize) {
        const chunk = questionIds.slice(i, i + chunkSize);
        const { data: questionRows } = await supabase.from("questions").select("id, category").in("id", chunk);
        (questionRows as { id: string; category: string | null }[] | null | undefined)?.forEach((q) => {
          categoryById.set(q.id, q.category ?? "Sonstiges");
        });
      }

      const statsMap = new Map<string, { category: string; votes: number; yes: number; no: number }>();
      rows.forEach((vote) => {
        const category = categoryById.get(vote.question_id) ?? "Sonstiges";
        const current = statsMap.get(category) ?? { category, votes: 0, yes: 0, no: 0 };
        current.votes += 1;
        if (vote.choice === "yes") current.yes += 1;
        if (vote.choice === "no") current.no += 1;
        statsMap.set(category, current);
      });

      topCategories = Array.from(statsMap.values())
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 3);
    }
  } catch {
    topCategories = [];
  }

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
    topCategories,
  });
}
