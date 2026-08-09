import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { AnswerMode, Draft, PollOption, PollVisibility } from "@/app/data/mock";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { SmartBackButton } from "@/app/components/SmartBackButton";
import { ReportButton } from "@/app/components/ReportButton";
import { DraftReviewClient } from "@/app/p/[shareId]/DraftReviewClient";
import { FutureVoteGptLink } from "@/app/components/FutureVoteGptLink";
import { buildFutureVoteGptDiscussUrl } from "@/app/lib/futureVoteGpt";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getAdminSettings } from "@/app/lib/adminSettings";

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
  decision_source: string | null;
  created_at: string | null;
  visibility: PollVisibility | null;
  share_id: string | null;
  answer_mode: AnswerMode | null;
  is_resolvable: boolean | null;
  resolution_criteria: string | null;
  resolution_source: string | null;
  resolution_sources: string[] | null;
  resolution_deadline: string | null;
};

type DraftOptionRow = {
  id: string;
  label: string | null;
  votes_count: number | null;
};

function mapDraftRow(row: DraftRow, options?: PollOption[]): Draft {
  let timeLeft = row.time_left_hours ?? 72;
  if (row.created_at) {
    const createdMs = Date.parse(row.created_at);
    if (Number.isFinite(createdMs)) {
      const diffHours = (Date.now() - createdMs) / (1000 * 60 * 60);
      timeLeft = Math.max(0, timeLeft - diffHours);
    }
  }

  const normalizedOptions =
    options && options.length > 0
      ? (() => {
          const total = options.reduce((sum, opt) => sum + Math.max(0, opt.votesCount ?? 0), 0);
          const denom = Math.max(1, total);
          return options.map((opt) => ({
            ...opt,
            pct: Math.round((Math.max(0, opt.votesCount ?? 0) / denom) * 100),
          }));
        })()
      : undefined;

  return {
    id: row.id,
    creatorId: row.creator_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    region: row.region ?? undefined,
    imageUrl: row.image_url ?? undefined,
    imageCredit: row.image_credit ?? undefined,
    category: row.category,
    votesFor: Math.max(0, Number(row.votes_for ?? 0) || 0),
    votesAgainst: Math.max(0, Number(row.votes_against ?? 0) || 0),
    timeLeftHours: Math.max(0, Math.round(timeLeft)),
    status: (row.status ?? "open") as Draft["status"],
    decisionSource:
      row.decision_source === "community" || row.decision_source === "admin" ? row.decision_source : undefined,
    visibility: (row.visibility ?? "public") as PollVisibility,
    shareId: row.share_id ?? undefined,
    answerMode: row.answer_mode === "options" ? "options" : "binary",
    isResolvable: typeof row.is_resolvable === "boolean" ? row.is_resolvable : true,
    options: normalizedOptions,
    resolutionCriteria: row.resolution_criteria ?? undefined,
    resolutionSource: row.resolution_source ?? undefined,
    resolutionSources: Array.isArray(row.resolution_sources)
      ? row.resolution_sources.map((v) => String(v ?? "").trim()).filter(Boolean).slice(0, 8)
      : row.resolution_source
        ? [row.resolution_source]
        : undefined,
    resolutionDeadline: row.resolution_deadline ?? undefined,
  };
}

export default async function ReviewDraftDetailPage(props: { params: Promise<{ id: string }> }) {
  const resolvedParams = await props.params;
  const id = (resolvedParams.id ?? "").trim();
  if (!id) notFound();

  const supabase = getSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from("drafts")
    .select(
      "id,creator_id,title,description,region,image_url,image_credit,category,votes_for,votes_against,time_left_hours,status,decision_source,created_at,visibility,share_id,answer_mode,is_resolvable,resolution_criteria,resolution_source,resolution_sources,resolution_deadline"
    )
    .eq("id", id)
    .eq("visibility", "public")
    .maybeSingle();

  if (error || !row) notFound();

  const draftRow = row as DraftRow;
  let options: PollOption[] | undefined = undefined;
  if ((draftRow.answer_mode ?? "binary") === "options") {
    const { data: optRows, error: optError } = await supabase
      .from("draft_options")
      .select("id,label,votes_count,sort_order")
      .eq("draft_id", draftRow.id)
      .order("sort_order", { ascending: true });
    if (optError) {
      throw new Error(`Konnte Draft-Optionen nicht laden: ${optError.message}`);
    }
    options = ((optRows as DraftOptionRow[] | null) ?? []).map((opt) => ({
      id: String(opt.id),
      label: String(opt.label ?? ""),
      votesCount: Math.max(0, Number(opt.votes_count ?? 0) || 0),
    }));
  }

  const cookieStore = await cookies();
  const userSessionId = cookieStore.get("fv_user")?.value;
  const currentUser = userSessionId ? await getUserBySessionSupabase(userSessionId).catch(() => null) : null;
  let alreadyReviewed = false;
  if (currentUser) {
    const { data: reviewRows, error: reviewError } = await supabase
      .from("draft_reviews")
      .select("id")
      .eq("draft_id", id)
      .eq("reviewer_user_id", currentUser.id)
      .limit(1);
    alreadyReviewed = !reviewError && Boolean(reviewRows && reviewRows.length > 0);
  }

  const [draft, adminSettings] = await Promise.all([
    Promise.resolve(mapDraftRow(draftRow, options)),
    getAdminSettings(),
  ]);
  const discussWithGptUrl = buildFutureVoteGptDiscussUrl({
    title: draft.title,
    category: draft.category,
    region: draft.region ?? null,
    description: draft.description ?? null,
    answerMode: draft.answerMode ?? null,
    isResolvable: draft.isResolvable ?? null,
    sourceUrl: null,
  });

  return (
    <main className="min-h-screen bg-transparent p-6 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <SmartBackButton fallbackHref="/" label="← Zurück zum Review" />

        <section className="mt-6 w-full max-w-xl space-y-3">
          <p className="max-w-xl text-sm text-slate-300">
            Prüfe den Draft im Detail und entscheide dann fair mit „Gute Frage“ oder „Ablehnen“.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <FutureVoteGptLink href={discussWithGptUrl} />
            <ReportButton kind="draft" itemId={draft.id} itemTitle={draft.title} />
          </div>
          {!currentUser ? <p className="text-sm text-amber-100">Zum Bewerten bitte anmelden.</p> : null}
          {currentUser && !currentUser.emailVerified ? (
            <p className="text-sm text-amber-100">Bitte bestätige zuerst deine E-Mail-Adresse.</p>
          ) : null}
          <DraftReviewClient
            initialDraft={draft}
            alreadyReviewedInitial={alreadyReviewed}
            readOnly={!currentUser?.emailVerified || currentUser.id === draft.creatorId}
            reviewRules={{
              minTotalReviews: adminSettings.draftMinTotalReviews,
              minLead: adminSettings.draftMinLead,
            }}
          />
        </section>
      </div>
    </main>
  );
}
