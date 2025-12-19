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
};

const DEFAULT_PREFS: NotificationPrefs = {
  allEmailsEnabled: true,
  privatePollResults: true,
  privatePollEndingSoon: false,
  creatorPublicQuestionEnded: true,
  creatorPublicQuestionResolved: true,
};

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  return fallback;
}

async function getUserFromCookie() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) return null;
  return getUserBySessionSupabase(sessionId);
}

export async function GET() {
  const user = await getUserFromCookie();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  try {
    const { data, error } = await supabase
      .from("notification_preferences")
      .select(
        "all_emails_enabled, private_poll_results, private_poll_ending_soon, creator_public_question_ended, creator_public_question_resolved"
      )
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) throw error;

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
  };

  const supabase = getSupabaseAdminClient();

  try {
    const { error } = await supabase.from("notification_preferences").upsert(
      {
        user_id: user.id,
        all_emails_enabled: next.allEmailsEnabled,
        private_poll_results: next.privatePollResults,
        private_poll_ending_soon: next.privatePollEndingSoon,
        creator_public_question_ended: next.creatorPublicQuestionEnded,
        creator_public_question_resolved: next.creatorPublicQuestionResolved,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;

    return NextResponse.json({ ok: true, prefs: next });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Konnte Einstellungen nicht speichern." }, { status: 500 });
  }
}
