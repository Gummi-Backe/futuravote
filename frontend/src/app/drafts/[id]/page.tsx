import Link from "next/link";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Draft } from "@/app/data/mock";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { DraftReviewClient } from "@/app/p/[shareId]/DraftReviewClient";

export const dynamic = "force-dynamic";

type DraftRow = {
  id: string;
  creator_id: string | null;
  title: string;
  description: string | null;
  region: string | null;
  image_url: string | null;
  image_credit: string | null;
  category: string;
  votes_for: number | null;
  votes_against: number | null;
  time_left_hours: number | null;
  status: string | null;
  created_at: string | null;
};

function mapDraftRow(row: DraftRow): Draft {
  let timeLeft = row.time_left_hours ?? 72;
  if (row.created_at) {
    const createdMs = Date.parse(row.created_at);
    if (Number.isFinite(createdMs)) {
      const diffHours = (Date.now() - createdMs) / (1000 * 60 * 60);
      timeLeft = Math.max(0, timeLeft - diffHours);
    }
  }
  const roundedTimeLeft = Math.max(0, Math.round(timeLeft));

  return {
    id: row.id,
    creatorId: row.creator_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    region: row.region ?? undefined,
    imageUrl: row.image_url ?? undefined,
    imageCredit: row.image_credit ?? undefined,
    category: row.category,
    votesFor: row.votes_for ?? 0,
    votesAgainst: row.votes_against ?? 0,
    timeLeftHours: roundedTimeLeft,
    status: (row.status ?? "open") as Draft["status"],
  };
}

export default async function DraftDetailPage(props: { params: Promise<{ id: string }> }) {
  const resolvedParams = await props.params;
  const id = (resolvedParams.id ?? "").trim();
  if (!id) notFound();

  const cookieStore = await cookies();
  const userSessionId = cookieStore.get("fv_user")?.value;
  if (!userSessionId) redirect("/auth");

  const currentUser = await getUserBySessionSupabase(userSessionId);
  if (!currentUser) redirect("/auth");

  const supabase = getSupabaseAdminClient();

  const { data: row, error } = await supabase
    .from("drafts")
    .select("id,creator_id,title,description,region,image_url,image_credit,category,votes_for,votes_against,time_left_hours,status,created_at")
    .eq("id", id)
    .eq("creator_id", currentUser.id)
    .maybeSingle();

  if (error || !row) notFound();

  const sessionId = cookieStore.get("fv_session")?.value ?? null;
  let alreadyReviewed = false;
  if (sessionId) {
    const { data: reviewRows, error: reviewError } = await supabase
      .from("draft_reviews")
      .select("id")
      .eq("draft_id", id)
      .eq("session_id", sessionId)
      .limit(1);
    alreadyReviewed = !reviewError && Boolean(reviewRows && reviewRows.length > 0);
  }

  const draft = mapDraftRow(row as DraftRow);

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link href="/profil?tab=drafts" className="text-sm text-slate-200 hover:text-white">
          &larr; Zurück
        </Link>

        <section className="mt-6 space-y-3">
          <p className="max-w-xl text-sm text-slate-300">
            So sieht dein Draft im Review-Bereich aus. Hier kannst du den Status und die aktuellen Stimmen sehen.
          </p>
          <DraftReviewClient initialDraft={draft} alreadyReviewedInitial={alreadyReviewed} />
        </section>
      </div>
    </main>
  );
}

