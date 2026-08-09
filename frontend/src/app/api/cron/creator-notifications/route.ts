import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { logAnalyticsEventServer } from "@/app/data/dbSupabaseAnalytics";
import {
  sendCreatorPublicQuestionEndedEmail,
  sendCreatorPublicQuestionResolvedEmail,
  sendCreatorDraftAcceptedEmail,
  sendCreatorDraftRejectedEmail,
} from "@/app/lib/email";

export const revalidate = 0;

type NotificationPreferenceRow = {
  all_emails_enabled?: boolean | null;
  creator_public_question_ended?: boolean | null;
  creator_public_question_resolved?: boolean | null;
  creator_draft_accepted?: boolean | null;
  creator_draft_rejected?: boolean | null;
};

type EndedQuestionRow = {
  id: string;
  title: string | null;
  closes_at: string | null;
  creator_id: string;
  visibility: string | null;
};

type ResolvedQuestionRow = {
  id: string;
  title: string | null;
  creator_id: string;
  answer_mode: string | null;
  resolved_outcome: string | null;
  resolved_option_id: string | null;
  resolved_at: string | null;
  resolved_source: string | null;
  visibility: string | null;
};

type DecidedDraftRow = {
  id: string;
  title: string | null;
  creator_id: string;
  status: string | null;
  visibility: string | null;
  share_id: string | null;
};

type QuestionSentRow = { question_id: string };
type DraftSentRow = { draft_id: string };
type OptionLabelRow = { id: string; label: string | null };
type UserInfoRow = { email: string | null; display_name: string | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isVercelCron(request: Request): boolean {
  const header = request.headers.get("x-vercel-cron");
  return header === "1" || header === "true";
}

function isMissingColumnSchemaCacheError(error: unknown): boolean {
  const code = isRecord(error) && typeof error.code === "string" ? error.code : "";
  const message = isRecord(error) && typeof error.message === "string" ? error.message : "";
  return (
    code === "PGRST204" ||
    message.includes("schema cache") ||
    message.includes("Could not find the") ||
    message.includes("Could not find")
  );
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
  creatorDraftAccepted: boolean;
  creatorDraftRejected: boolean;
}> {
  try {
    const selectFull =
      "all_emails_enabled, creator_public_question_ended, creator_public_question_resolved, creator_draft_accepted, creator_draft_rejected";
    const selectLegacy = "all_emails_enabled, creator_public_question_ended, creator_public_question_resolved";

    let data: NotificationPreferenceRow | null = null;
    {
      const { data: row, error } = await supabase
        .from("notification_preferences")
        .select(selectFull)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) {
        if (!isMissingColumnSchemaCacheError(error)) throw error;
        const { data: legacyRow, error: legacyErr } = await supabase
          .from("notification_preferences")
          .select(selectLegacy)
          .eq("user_id", userId)
          .maybeSingle();
        if (legacyErr) throw legacyErr;
        data = legacyRow as NotificationPreferenceRow | null;
      } else {
        data = row as NotificationPreferenceRow | null;
      }
    }
    return {
      allEmailsEnabled: typeof data?.all_emails_enabled === "boolean" ? data.all_emails_enabled : true,
      creatorPublicQuestionEnded:
        typeof data?.creator_public_question_ended === "boolean" ? data.creator_public_question_ended : true,
      creatorPublicQuestionResolved:
        typeof data?.creator_public_question_resolved === "boolean"
          ? data.creator_public_question_resolved
          : true,
      creatorDraftAccepted: typeof data?.creator_draft_accepted === "boolean" ? data.creator_draft_accepted : true,
      creatorDraftRejected: typeof data?.creator_draft_rejected === "boolean" ? data.creator_draft_rejected : true,
    };
  } catch {
    // Falls Setup fehlt: Default = an (wie in UI)
    return {
      allEmailsEnabled: true,
      creatorPublicQuestionEnded: true,
      creatorPublicQuestionResolved: true,
      creatorDraftAccepted: true,
      creatorDraftRejected: true,
    };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(500, Math.trunc(limitRaw))) : 100;
  const nowIso = new Date().toISOString();

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

  const endedRows = (endedQuestions ?? []) as EndedQuestionRow[];
  const endedIds = endedRows.map((r) => String(r.id));
  const { data: endedSentRows, error: endedSentErr } = endedIds.length
    ? await supabase.from("creator_question_ended_emails").select("question_id").in("question_id", endedIds)
    : { data: [] as QuestionSentRow[], error: null };

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

  const endedAlready = new Set(((endedSentRows ?? []) as QuestionSentRow[]).map((r) => String(r.question_id)));
  const endedPending = endedRows.filter((r) => !endedAlready.has(String(r.id)));

  // 2) "Resolved" (Ergebnis eingetragen) fuer public questions
  const { data: resolvedQuestions, error: resolvedErr } = await supabase
    .from("questions")
    .select("id,title,creator_id,answer_mode,resolved_outcome,resolved_option_id,resolved_at,resolved_source,visibility")
    .eq("visibility", "public")
    .not("creator_id", "is", null)
    .or("resolved_outcome.not.is.null,resolved_option_id.not.is.null")
    .limit(limit);

  if (resolvedErr) {
    return NextResponse.json({ ok: false, error: "Konnte aufgeloeste Fragen nicht laden.", details: resolvedErr.message }, { status: 500 });
  }

  const resolvedRows = (resolvedQuestions ?? []) as ResolvedQuestionRow[];
  const resolvedIds = resolvedRows.map((r) => String(r.id));
  const { data: resolvedSentRows, error: resolvedSentErr } = resolvedIds.length
    ? await supabase.from("creator_question_resolved_emails").select("question_id").in("question_id", resolvedIds)
    : { data: [] as QuestionSentRow[], error: null };

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

  const resolvedAlready = new Set(((resolvedSentRows ?? []) as QuestionSentRow[]).map((r) => String(r.question_id)));
  const resolvedPending = resolvedRows.filter((r) => !resolvedAlready.has(String(r.id)));

  const optionLabelById = new Map<string, string>();
  const resolvedOptionIds = resolvedPending
    .map((r) => String(r.resolved_option_id ?? ""))
    .filter(Boolean);
  for (let i = 0; i < resolvedOptionIds.length; i += 200) {
    const chunk = resolvedOptionIds.slice(i, i + 200);
    const { data: optionRows } = await supabase.from("question_options").select("id,label").in("id", chunk);
    ((optionRows ?? []) as OptionLabelRow[]).forEach((o) => optionLabelById.set(String(o.id), String(o.label ?? "")));
  }

  // 3) Draft-Entscheide (accepted/rejected) fuer Creator
  const { data: decidedDrafts, error: draftsErr } = await supabase
    .from("drafts")
    .select("id,title,creator_id,status,visibility,share_id")
    .in("status", ["accepted", "rejected"])
    .not("creator_id", "is", null)
    .limit(limit);

  if (draftsErr) {
    return NextResponse.json({ ok: false, error: "Konnte Draft-Entscheide nicht laden.", details: draftsErr.message }, { status: 500 });
  }

  const draftRows = (decidedDrafts ?? []) as DecidedDraftRow[];
  const draftIds = draftRows.map((r) => String(r.id));
  const { data: draftSentRows, error: draftSentErr } = draftIds.length
    ? await supabase.from("creator_draft_decision_emails").select("draft_id").in("draft_id", draftIds)
    : { data: [] as DraftSentRow[], error: null };

  if (draftSentErr) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Outbox-Tabelle fehlt oder ist nicht erreichbar. Fuehre `supabase/creator_draft_emails.sql` in Supabase aus.",
        details: draftSentErr.message,
      },
      { status: 500 }
    );
  }

  const draftsAlready = new Set(((draftSentRows ?? []) as DraftSentRow[]).map((r) => String(r.draft_id)));
  const draftsPending = draftRows.filter((r) => !draftsAlready.has(String(r.id)));

  let endedSent = 0;
  let resolvedSent = 0;
  let draftDecisionSent = 0;
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
    const typedUserRow = userRow as UserInfoRow | null;
    if (userErr || !typedUserRow?.email) return null;
    const prefs = await getPrefs(supabase, creatorId);
    const info = {
      email: typedUserRow.email,
      displayName: String(typedUserRow.display_name ?? ""),
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

    const answerMode = String(row.answer_mode ?? "") === "options" ? "options" : "binary";
    const outcome = String(row.resolved_outcome ?? "");
    const resolvedOptionId = String(row.resolved_option_id ?? "");
    const resolvedOutcomeLabel =
      answerMode === "options" && resolvedOptionId
        ? optionLabelById.get(resolvedOptionId) || "Option"
        : outcome === "yes"
          ? "Ja"
          : outcome === "no"
            ? "Nein"
            : outcome;

    const questionUrl = `${siteUrl}/questions/${encodeURIComponent(String(row.id))}`;
    if (!info.prefs.allEmailsEnabled || !info.prefs.creatorPublicQuestionResolved) {
      try {
        await supabase.from("creator_question_resolved_emails").insert({
          question_id: String(row.id),
          creator_id: creatorId,
          to_email: info.email,
          resolved_at: (row.resolved_at as string | null) ?? null,
          resolved_outcome: resolvedOutcomeLabel || null,
        });
      } catch {
        // ignore
      }
      continue;
    }
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
        resolved_outcome: resolvedOutcomeLabel || null,
      });

      resolvedSent += 1;
    } catch {
      skipped += 1;
    }
  }

  for (const row of draftsPending) {
    const draftId = String(row.id);
    const creatorId = String(row.creator_id);
    const status = String(row.status ?? "");
    const decision = status === "accepted" ? "accepted" : "rejected";

    const info = await getUserInfo(creatorId);
    if (!info) {
      skipped += 1;
      continue;
    }

    const prefsAllowed =
      info.prefs.allEmailsEnabled &&
      (decision === "accepted" ? info.prefs.creatorDraftAccepted : info.prefs.creatorDraftRejected);

    const draftUrl = `${siteUrl}/drafts/${encodeURIComponent(draftId)}`;
    const questionId = draftId.startsWith("q_") ? draftId : `q_${draftId}`;
    const shareId = row.share_id ? String(row.share_id) : null;
    const visibility = row.visibility ? String(row.visibility) : "public";
    const acceptedUrl =
      visibility === "link_only" && shareId ? `${siteUrl}/p/${encodeURIComponent(shareId)}` : `${siteUrl}/questions/${encodeURIComponent(questionId)}`;

    if (!prefsAllowed) {
      try {
        await supabase.from("creator_draft_decision_emails").insert({
          draft_id: draftId,
          creator_id: creatorId,
          to_email: info.email,
          decision,
          question_id: decision === "accepted" ? questionId : null,
          share_id: decision === "accepted" ? shareId : null,
        });
      } catch {
        // ignore
      }
      continue;
    }

    try {
      if (decision === "accepted") {
        await sendCreatorDraftAcceptedEmail({
          to: info.email,
          displayName: info.displayName,
          title: String(row.title ?? ""),
          targetUrl: acceptedUrl,
        });
      } else {
        await sendCreatorDraftRejectedEmail({
          to: info.email,
          displayName: info.displayName,
          title: String(row.title ?? ""),
          draftUrl,
        });
      }

      await supabase.from("creator_draft_decision_emails").insert({
        draft_id: draftId,
        creator_id: creatorId,
        to_email: info.email,
        decision,
        question_id: decision === "accepted" ? questionId : null,
        share_id: decision === "accepted" ? shareId : null,
      });

      draftDecisionSent += 1;
    } catch {
      skipped += 1;
    }
  }

  const payload = {
    ok: true,
    endedChecked: endedRows.length,
    endedPending: endedPending.length,
    endedSent,
    resolvedChecked: resolvedRows.length,
    resolvedPending: resolvedPending.length,
    resolvedSent,
    draftChecked: draftRows.length,
    draftPending: draftsPending.length,
    draftDecisionSent,
    skipped,
    todayUtc: todayUtcIso,
    nowUtc: nowIso,
  };

  await logAnalyticsEventServer({
    event: "cron_creator_notifications_run",
    sessionId: "cron_creator_notifications",
    path: "/api/cron/creator-notifications",
    meta: { ...payload, limit },
  });

  return NextResponse.json(payload);
}
