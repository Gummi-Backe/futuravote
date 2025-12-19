import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import {
  sendCreatorPublicQuestionEndedEmail,
  sendCreatorPublicQuestionResolvedEmail,
} from "@/app/lib/email";

export const revalidate = 0;

function isVercelCron(request: Request): boolean {
  const header = request.headers.get("x-vercel-cron");
  return header === "1" || header === "true";
}

function getSiteUrl(requestUrl: string) {
  const envBase = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (envBase) return envBase.replace(/\/+$/, "");
  try {
    const u = new URL(requestUrl);
    return `${u.protocol}//${u.host}`;
  } catch {
    return "https://www.future-vote.de";
  }
}

function formatDateGerman(dateIso?: string | null) {
  if (!dateIso) return "unbekannt";
  const ms = Date.parse(dateIso);
  if (!Number.isFinite(ms)) return dateIso;
  return new Date(ms).toLocaleDateString("de-DE", { year: "numeric", month: "2-digit", day: "2-digit" });
}

async function getPrefs(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string
): Promise<{
  allEmailsEnabled: boolean;
  creatorPublicQuestionEnded: boolean;
  creatorPublicQuestionResolved: boolean;
}> {
  try {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select("all_emails_enabled, creator_public_question_ended, creator_public_question_resolved")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return {
      allEmailsEnabled: typeof (data as any)?.all_emails_enabled === "boolean" ? (data as any).all_emails_enabled : true,
      creatorPublicQuestionEnded:
        typeof (data as any)?.creator_public_question_ended === "boolean" ? (data as any).creator_public_question_ended : true,
      creatorPublicQuestionResolved:
        typeof (data as any)?.creator_public_question_resolved === "boolean"
          ? (data as any).creator_public_question_resolved
          : true,
    };
  } catch {
    // Falls Setup fehlt: Default = an (wie in UI)
    return { allEmailsEnabled: true, creatorPublicQuestionEnded: true, creatorPublicQuestionResolved: true };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : 100;

  const secret = process.env.FV_CRON_SECRET?.trim() ?? "";
  const providedSecret = url.searchParams.get("secret") ?? "";

  if (!isVercelCron(request) && secret && providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const siteUrl = getSiteUrl(request.url);

  const todayUtcIso = new Date().toISOString().slice(0, 10);

  // 1) "Ended" (Abstimmung vorbei) fuer public questions
  const { data: endedQuestions, error: endedErr } = await supabase
    .from("questions")
    .select("id,title,closes_at,creator_id,visibility")
    .eq("visibility", "public")
    .lt("closes_at", todayUtcIso)
    .not("creator_id", "is", null)
    .limit(limit);

  if (endedErr) {
    return NextResponse.json({ ok: false, error: "Konnte beendete Fragen nicht laden.", details: endedErr.message }, { status: 500 });
  }

  const endedRows = (endedQuestions ?? []) as any[];
  const endedIds = endedRows.map((r) => String(r.id));
  const { data: endedSentRows, error: endedSentErr } = endedIds.length
    ? await supabase.from("creator_question_ended_emails").select("question_id").in("question_id", endedIds)
    : { data: [], error: null as any };

  if (endedSentErr) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Outbox-Tabelle fehlt oder ist nicht erreichbar. Fuehre `supabase/creator_question_emails.sql` in Supabase aus.",
        details: endedSentErr.message,
      },
      { status: 500 }
    );
  }

  const endedAlready = new Set((endedSentRows ?? []).map((r: any) => String(r.question_id)));
  const endedPending = endedRows.filter((r) => !endedAlready.has(String(r.id)));

  // 2) "Resolved" (Ergebnis eingetragen) fuer public questions
  const { data: resolvedQuestions, error: resolvedErr } = await supabase
    .from("questions")
    .select("id,title,creator_id,resolved_outcome,resolved_at,resolved_source,visibility")
    .eq("visibility", "public")
    .not("creator_id", "is", null)
    .not("resolved_outcome", "is", null)
    .limit(limit);

  if (resolvedErr) {
    return NextResponse.json({ ok: false, error: "Konnte aufgeloeste Fragen nicht laden.", details: resolvedErr.message }, { status: 500 });
  }

  const resolvedRows = (resolvedQuestions ?? []) as any[];
  const resolvedIds = resolvedRows.map((r) => String(r.id));
  const { data: resolvedSentRows, error: resolvedSentErr } = resolvedIds.length
    ? await supabase.from("creator_question_resolved_emails").select("question_id").in("question_id", resolvedIds)
    : { data: [], error: null as any };

  if (resolvedSentErr) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Outbox-Tabelle fehlt oder ist nicht erreichbar. Fuehre `supabase/creator_question_emails.sql` in Supabase aus.",
        details: resolvedSentErr.message,
      },
      { status: 500 }
    );
  }

  const resolvedAlready = new Set((resolvedSentRows ?? []).map((r: any) => String(r.question_id)));
  const resolvedPending = resolvedRows.filter((r) => !resolvedAlready.has(String(r.id)));

  let endedSent = 0;
  let resolvedSent = 0;
  let skipped = 0;

  const userCache = new Map<string, { email: string; displayName: string; prefs: Awaited<ReturnType<typeof getPrefs>> }>();

  async function getUserInfo(creatorId: string) {
    const cached = userCache.get(creatorId);
    if (cached) return cached;
    const { data: userRow, error: userErr } = await supabase
      .from("users")
      .select("email, display_name")
      .eq("id", creatorId)
      .maybeSingle();
    if (userErr || !userRow || !(userRow as any).email) return null;
    const prefs = await getPrefs(supabase, creatorId);
    const info = {
      email: String((userRow as any).email),
      displayName: String((userRow as any).display_name ?? ""),
      prefs,
    };
    userCache.set(creatorId, info);
    return info;
  }

  for (const row of endedPending) {
    const creatorId = String(row.creator_id);
    const info = await getUserInfo(creatorId);
    if (!info) {
      skipped += 1;
      continue;
    }
    if (!info.prefs.allEmailsEnabled || !info.prefs.creatorPublicQuestionEnded) {
      // trotzdem Outbox schreiben, damit es nicht immer wieder versucht wird
      try {
        await supabase.from("creator_question_ended_emails").insert({
          question_id: String(row.id),
          creator_id: creatorId,
          to_email: info.email,
          closes_at: String(row.closes_at ?? "") || null,
        });
      } catch {
        // ignore
      }
      continue;
    }

    const questionUrl = `${siteUrl}/questions/${encodeURIComponent(String(row.id))}`;
    try {
      await sendCreatorPublicQuestionEndedEmail({
        to: info.email,
        displayName: info.displayName,
        title: String(row.title ?? ""),
        questionUrl,
        closesAtLabel: `Ende: ${formatDateGerman(String(row.closes_at ?? ""))}`,
      });

      await supabase.from("creator_question_ended_emails").insert({
        question_id: String(row.id),
        creator_id: creatorId,
        to_email: info.email,
        closes_at: String(row.closes_at ?? "") || null,
      });

      endedSent += 1;
    } catch {
      skipped += 1;
    }
  }

  for (const row of resolvedPending) {
    const creatorId = String(row.creator_id);
    const info = await getUserInfo(creatorId);
    if (!info) {
      skipped += 1;
      continue;
    }
    if (!info.prefs.allEmailsEnabled || !info.prefs.creatorPublicQuestionResolved) {
      try {
        await supabase.from("creator_question_resolved_emails").insert({
          question_id: String(row.id),
          creator_id: creatorId,
          to_email: info.email,
          resolved_at: (row.resolved_at as string | null) ?? null,
          resolved_outcome: (row.resolved_outcome as string | null) ?? null,
        });
      } catch {
        // ignore
      }
      continue;
    }

    const questionUrl = `${siteUrl}/questions/${encodeURIComponent(String(row.id))}`;
    const outcome = String(row.resolved_outcome ?? "");
    const resolvedOutcomeLabel = outcome === "yes" ? "Ja" : outcome === "no" ? "Nein" : outcome;
    try {
      await sendCreatorPublicQuestionResolvedEmail({
        to: info.email,
        displayName: info.displayName,
        title: String(row.title ?? ""),
        questionUrl,
        resolvedOutcomeLabel,
        resolvedSource: (row.resolved_source as string | null | undefined) ?? null,
      });

      await supabase.from("creator_question_resolved_emails").insert({
        question_id: String(row.id),
        creator_id: creatorId,
        to_email: info.email,
        resolved_at: (row.resolved_at as string | null) ?? null,
        resolved_outcome: (row.resolved_outcome as string | null) ?? null,
      });

      resolvedSent += 1;
    } catch {
      skipped += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    endedChecked: endedRows.length,
    endedPending: endedPending.length,
    endedSent,
    resolvedChecked: resolvedRows.length,
    resolvedPending: resolvedPending.length,
    resolvedSent,
    skipped,
    todayUtc: todayUtcIso,
  });
}
