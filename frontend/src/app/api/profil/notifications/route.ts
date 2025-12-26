import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

type NotificationPrefs = {
  allEmailsEnabled: boolean;
  privatePollResults: boolean;
  privatePollEndingSoon: boolean;
  creatorPublicQuestionEnded: boolean;
  creatorPublicQuestionResolved: boolean;
  creatorDraftAccepted: boolean;
  creatorDraftRejected: boolean;
};

const DEFAULT_PREFS: NotificationPrefs = {
  allEmailsEnabled: true,
  privatePollResults: true,
  privatePollEndingSoon: false,
  creatorPublicQuestionEnded: true,
  creatorPublicQuestionResolved: true,
  creatorDraftAccepted: true,
  creatorDraftRejected: true,
};

function isMissingColumnSchemaCacheError(error: unknown): boolean {
  const e = error as any;
  const code = typeof e?.code === "string" ? e.code : "";
  const message = typeof e?.message === "string" ? e.message : "";
  return (
    code === "PGRST204" ||
    message.includes("schema cache") ||
    message.includes("Could not find the") ||
    message.includes("Could not find")
  );
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

function extractMissingColumnName(error: unknown): string | null {
  const message = String((error as any)?.message ?? "");
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ? String(match[1]) : null;
}

async function getUserFromCookie() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) return null;
  return getUserBySessionSupabase(sessionId);
}

async function selectPrefsRow(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  userId: string
): Promise<Record<string, unknown> | null> {
  const columns = [
    "all_emails_enabled",
    "private_poll_results",
    "private_poll_ending_soon",
    "creator_public_question_ended",
    "creator_public_question_resolved",
    "creator_draft_accepted",
    "creator_draft_rejected",
  ];

  const remaining = [...columns];
  for (let i = 0; i < columns.length; i += 1) {
    const select = remaining.join(", ");
    const { data, error } = await supabase.from("notification_preferences").select(select).eq("user_id", userId).maybeSingle();
    if (!error) return (data ?? null) as any;
    if (!isMissingColumnSchemaCacheError(error)) throw error;
    const missing = extractMissingColumnName(error);
    if (!missing) throw error;
    const idx = remaining.indexOf(missing);
    if (idx === -1) throw error;
    remaining.splice(idx, 1);
  }
  return null;
}

async function upsertWithMissingColumnRetry(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  payload: Record<string, unknown>
) {
  const remaining: Record<string, unknown> = { ...payload };
  const removed = new Set<string>();

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const { error } = await supabase.from("notification_preferences").upsert(remaining, { onConflict: "user_id" });
    if (!error) return { removed };
    if (!isMissingColumnSchemaCacheError(error)) throw error;
    const missing = extractMissingColumnName(error);
    if (!missing || removed.has(missing) || !(missing in remaining)) throw error;
    delete (remaining as any)[missing];
    removed.add(missing);
  }

  throw new Error("Konnte Einstellungen nicht speichern (zu viele fehlende Spalten).");
}

export async function GET() {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  try {
    const data = (await selectPrefsRow(supabase, user.id)) as any;

    const prefs: NotificationPrefs = {
      allEmailsEnabled: normalizeBoolean((data as any)?.all_emails_enabled, DEFAULT_PREFS.allEmailsEnabled),
      privatePollResults: normalizeBoolean((data as any)?.private_poll_results, DEFAULT_PREFS.privatePollResults),
      privatePollEndingSoon: normalizeBoolean(
        (data as any)?.private_poll_ending_soon,
        DEFAULT_PREFS.privatePollEndingSoon
      ),
      creatorPublicQuestionEnded: normalizeBoolean(
        (data as any)?.creator_public_question_ended,
        DEFAULT_PREFS.creatorPublicQuestionEnded
      ),
      creatorPublicQuestionResolved: normalizeBoolean(
        (data as any)?.creator_public_question_resolved,
        DEFAULT_PREFS.creatorPublicQuestionResolved
      ),
      creatorDraftAccepted: normalizeBoolean((data as any)?.creator_draft_accepted, DEFAULT_PREFS.creatorDraftAccepted),
      creatorDraftRejected: normalizeBoolean((data as any)?.creator_draft_rejected, DEFAULT_PREFS.creatorDraftRejected),
    };

    return NextResponse.json({ ok: true, prefs });
  } catch {
    // Falls die Tabelle noch nicht existiert (Setup nicht ausgefuehrt),
    // liefern wir Default-Prefs zurueck, damit die App weiterhin funktioniert.
    return NextResponse.json({ ok: true, prefs: DEFAULT_PREFS, note: "notification_preferences missing? using defaults" });
  }
}

export async function PUT(request: Request) {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "Ungueltige Anfrage." }, { status: 400 });
  }

  const next: NotificationPrefs = {
    allEmailsEnabled: normalizeBoolean(body.allEmailsEnabled, DEFAULT_PREFS.allEmailsEnabled),
    privatePollResults: normalizeBoolean(body.privatePollResults, DEFAULT_PREFS.privatePollResults),
    privatePollEndingSoon: normalizeBoolean(body.privatePollEndingSoon, DEFAULT_PREFS.privatePollEndingSoon),
    creatorPublicQuestionEnded: normalizeBoolean(body.creatorPublicQuestionEnded, DEFAULT_PREFS.creatorPublicQuestionEnded),
    creatorPublicQuestionResolved: normalizeBoolean(
      body.creatorPublicQuestionResolved,
      DEFAULT_PREFS.creatorPublicQuestionResolved
    ),
    creatorDraftAccepted: normalizeBoolean(body.creatorDraftAccepted, DEFAULT_PREFS.creatorDraftAccepted),
    creatorDraftRejected: normalizeBoolean(body.creatorDraftRejected, DEFAULT_PREFS.creatorDraftRejected),
  };

  const supabase = getSupabaseAdminClient();

  try {
    const payloadFull: Record<string, unknown> = {
      user_id: user.id,
      all_emails_enabled: next.allEmailsEnabled,
      private_poll_results: next.privatePollResults,
      private_poll_ending_soon: next.privatePollEndingSoon,
      creator_public_question_ended: next.creatorPublicQuestionEnded,
      creator_public_question_resolved: next.creatorPublicQuestionResolved,
      creator_draft_accepted: next.creatorDraftAccepted,
      creator_draft_rejected: next.creatorDraftRejected,
      updated_at: new Date().toISOString(),
    };

    const { removed } = await upsertWithMissingColumnRetry(supabase, payloadFull);

    const note =
      removed.size > 0
        ? `Hinweis: In Supabase fehlen Spalten (${Array.from(removed).join(", ")}). Bitte 'supabase/notification_preferences.sql' ausführen.`
        : undefined;

    return NextResponse.json({ ok: true, prefs: next, note });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Konnte Einstellungen nicht speichern." }, { status: 500 });
  }
}
