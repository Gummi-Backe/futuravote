import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

type LastEvent = { createdAt: string | null; meta: unknown };
type EventRow = { created_at: string | null; meta: unknown };

function isoHoursAgo(hours: number): string {
  const ms = Date.now() - Math.max(1, hours) * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

async function lastEvent(supabase: ReturnType<typeof getSupabaseAdminClient>, event: string): Promise<LastEvent> {
  try {
    const { data, error } = await supabase
      .from("analytics_events")
      .select("created_at,meta")
      .eq("event", event)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    const row = (Array.isArray(data) && data.length ? data[0] : null) as EventRow | null;
    return { createdAt: typeof row?.created_at === "string" ? row.created_at : null, meta: row?.meta ?? null };
  } catch {
    return { createdAt: null, meta: null };
  }
}

async function countEventSince(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  event: string,
  sinceIso: string
): Promise<number> {
  try {
    const { count, error } = await supabase
      .from("analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("event", event)
      .gte("created_at", sinceIso);
    if (error) throw error;
    return typeof count === "number" ? count : 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId).catch(() => null) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
  }

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();
  const since24h = isoHoursAgo(24);

  const [
    cronResolutions,
    cronMetrics,
    cronCreatorEmails,
    cronPrivateResults,
    cronPrivateReminders,
    vote429,
    comment429,
  ] = await Promise.all([
    lastEvent(supabase, "cron_resolution_suggestions_run"),
    lastEvent(supabase, "cron_question_metrics_run"),
    lastEvent(supabase, "cron_creator_notifications_run"),
    lastEvent(supabase, "cron_private_poll_results_run"),
    lastEvent(supabase, "cron_private_poll_reminders_run"),
    countEventSince(supabase, "rate_limit_vote", since24h),
    countEventSince(supabase, "rate_limit_comment", since24h),
  ]);

  return NextResponse.json({
    ok: true,
    nowUtc: nowIso,
    since24hUtc: since24h,
    crons: {
      resolutionSuggestions: cronResolutions,
      questionMetrics: cronMetrics,
      creatorNotifications: cronCreatorEmails,
      privatePollResults: cronPrivateResults,
      privatePollReminders: cronPrivateReminders,
    },
    rateLimits24h: { votes429: vote429, comments429: comment429 },
  });
}
