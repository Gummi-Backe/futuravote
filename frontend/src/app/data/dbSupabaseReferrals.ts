import "server-only";

import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

type ReferralVisitRow = {
  path: string | null;
  meta: { sharerUserId?: string | null; questionId?: string | null } | null;
};

export async function creditReferralVote(options: {
  questionId: string;
  sessionId: string;
  viewerUserId?: string | null;
}) {
  const questionId = String(options.questionId ?? "").trim();
  const sessionId = String(options.sessionId ?? "").trim();
  const viewerUserId = options.viewerUserId ? String(options.viewerUserId).trim() : null;
  if (!questionId || !sessionId) return;

  const supabase = getSupabaseAdminClient();
  const canonicalPath = `/questions/${questionId}`;

  // Nur 1x pro Session & Frage belohnen.
  const { data: existingCredits, error: existingCreditsError } = await supabase
    .from("analytics_events")
    .select("id")
    .eq("event", "referral_vote")
    .eq("session_id", sessionId)
    .eq("path", canonicalPath)
    .limit(1);
  if (!existingCreditsError && (existingCredits ?? []).length > 0) return;

  // Letzte Referral-Visits dieser Session laden und den passenden finden.
  const { data: visits, error: visitsError } = await supabase
    .from("analytics_events")
    .select("path,meta")
    .eq("event", "referral_visit")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (visitsError) return;

  const rows = (visits ?? []) as ReferralVisitRow[];
  const match = rows.find((row) => {
    const metaQ = row?.meta?.questionId ? String(row.meta.questionId) : null;
    if (metaQ && metaQ === questionId) return true;
    const p = row?.path ? String(row.path) : "";
    return p === canonicalPath;
  });

  const sharerUserId = match?.meta?.sharerUserId ? String(match.meta.sharerUserId) : null;
  if (!sharerUserId) return;
  if (viewerUserId && viewerUserId === sharerUserId) return;

  await supabase.from("analytics_events").insert({
    event: "referral_vote",
    session_id: sessionId,
    user_id: viewerUserId,
    path: canonicalPath,
    referrer: null,
    meta: { sharerUserId, questionId },
  });
}

