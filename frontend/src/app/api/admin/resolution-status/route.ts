import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

type ResolutionQuestionRow = {
  is_resolvable: boolean | null;
  answer_mode: string | null;
  resolved_outcome: string | null;
  resolved_option_id: string | null;
  resolution_deadline: string | null;
};

type CronEventRow = { created_at: string | null; meta: unknown };

function needsResolution(q: ResolutionQuestionRow, nowIso: string): boolean {
  const isResolvable = q.is_resolvable === false ? false : true;
  if (!isResolvable) return false;

  const answerMode = q.answer_mode === "options" ? "options" : "binary";
  if (answerMode === "binary") {
    if (q.resolved_outcome === "yes" || q.resolved_outcome === "no") return false;
  } else {
    if (q.resolved_option_id) return false;
  }

  const deadline = q.resolution_deadline ? Date.parse(String(q.resolution_deadline)) : NaN;
  if (Number.isFinite(deadline)) return deadline <= Date.parse(nowIso);
  return true;
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

  // Wie viele Prognosen sind fällig und noch nicht aufgelöst?
  const { data: rows, error } = await supabase
    .from("questions")
    .select("id,visibility,closes_at,is_resolvable,answer_mode,resolved_outcome,resolved_option_id,resolution_deadline")
    .eq("visibility", "public")
    .lt("closes_at", nowIso)
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: `Supabase Fehler: ${error.message}` }, { status: 500 });
  }

  const unresolvedCount = ((rows ?? []) as ResolutionQuestionRow[]).filter((q) => needsResolution(q, nowIso)).length;

  // Letzter Cron-Lauf (optional; Analytics ist "best effort").
  let lastCronAt: string | null = null;
  let lastCronMeta: unknown = null;
  try {
    const { data: cronRows, error: cronErr } = await supabase
      .from("analytics_events")
      .select("created_at,meta")
      .eq("event", "cron_resolution_suggestions_run")
      .order("created_at", { ascending: false })
      .limit(1);
    if (!cronErr && Array.isArray(cronRows) && cronRows.length) {
      const cronRow = cronRows[0] as CronEventRow;
      lastCronAt = typeof cronRow.created_at === "string" ? cronRow.created_at : null;
      lastCronMeta = cronRow.meta ?? null;
    }
  } catch {
    // ignore
  }

  return NextResponse.json({ ok: true, unresolvedCount, lastCronAt, lastCronMeta, nowUtc: nowIso });
}
