import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getUserBySessionSupabase, getUserPasswordHashByIdSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
}

function logoutResponse(payload: unknown, status: number) {
  const response = NextResponse.json(payload, { status });
  response.cookies.set("fv_user", "", {
    path: "/",
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
  return response;
}

async function tryUpdateOrIgnoreMissingTable(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  table: string,
  values: Record<string, unknown>,
  whereColumn: string,
  whereValue: string
) {
  const { error } = await supabase.from(table).update(values).eq(whereColumn, whereValue);
  if (!error) return;
  const msg = String((error as any)?.message ?? "");
  const code = String((error as any)?.code ?? "");
  const isMissing = code === "42P01" || msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("schema cache");
  if (isMissing) return;
  throw new Error(`${table} update failed: ${msg || code || "unknown"}`);
}

async function tryDeleteOrIgnoreMissingTable(
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  table: string,
  whereColumn: string,
  whereValue: string
) {
  const { error } = await supabase.from(table).delete().eq(whereColumn, whereValue);
  if (!error) return;
  const msg = String((error as any)?.message ?? "");
  const code = String((error as any)?.code ?? "");
  const isMissing = code === "42P01" || msg.toLowerCase().includes("does not exist") || msg.toLowerCase().includes("schema cache");
  if (isMissing) return;
  throw new Error(`${table} delete failed: ${msg || code || "unknown"}`);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const user = await getUserBySessionSupabase(sessionId);
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  let body: { password?: string; confirmText?: string };
  try {
    body = (await request.json()) as { password?: string; confirmText?: string };
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const password = String(body.password ?? "");
  const confirmText = String(body.confirmText ?? "").trim().toUpperCase();

  if (!password) {
    return NextResponse.json({ error: "Bitte Passwort eingeben." }, { status: 400 });
  }
  if (confirmText !== "LÖSCHEN") {
    return NextResponse.json({ error: 'Bitte tippe zur Bestätigung „LÖSCHEN“.' }, { status: 400 });
  }

  const passwordHash = await getUserPasswordHashByIdSupabase(user.id);
  if (!passwordHash || !verifyPassword(password, passwordHash)) {
    return NextResponse.json({ error: "Passwort ist falsch." }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdminClient();

    // Inhalte dürfen ggf. bestehen bleiben, aber ohne Personenbezug.
    await tryUpdateOrIgnoreMissingTable(supabase, "drafts", { creator_id: null }, "creator_id", user.id);
    await tryUpdateOrIgnoreMissingTable(supabase, "questions", { creator_id: null }, "creator_id", user.id);
    await tryUpdateOrIgnoreMissingTable(supabase, "votes", { user_id: null }, "user_id", user.id);
    await tryUpdateOrIgnoreMissingTable(supabase, "analytics_events", { user_id: null }, "user_id", user.id);
    await tryUpdateOrIgnoreMissingTable(supabase, "reports", { reporter_user_id: null }, "reporter_user_id", user.id);

    // Server-Queues/Benachrichtigungs-Queues (optional, je nach DB-Stand).
    await tryUpdateOrIgnoreMissingTable(
      supabase,
      "question_resolution_suggestions",
      { created_by_user_id: null },
      "created_by_user_id",
      user.id
    );
    await tryUpdateOrIgnoreMissingTable(
      supabase,
      "private_poll_result_emails",
      { creator_id: null },
      "creator_id",
      user.id
    );
    await tryUpdateOrIgnoreMissingTable(
      supabase,
      "private_poll_reminder_emails",
      { creator_id: null },
      "creator_id",
      user.id
    );
    await tryUpdateOrIgnoreMissingTable(
      supabase,
      "creator_question_ended_emails",
      { creator_id: null },
      "creator_id",
      user.id
    );
    await tryUpdateOrIgnoreMissingTable(
      supabase,
      "creator_question_resolved_emails",
      { creator_id: null },
      "creator_id",
      user.id
    );
    await tryUpdateOrIgnoreMissingTable(
      supabase,
      "creator_draft_decision_emails",
      { creator_id: null },
      "creator_id",
      user.id
    );

    // Session invalidieren (sicherheitshalber vor dem User-Delete)
    await tryDeleteOrIgnoreMissingTable(supabase, "user_sessions", "user_id", user.id);

    // User löschen (FKs mit on delete cascade räumen abhängige Tabellen auf).
    const { error: userDelError } = await supabase.from("users").delete().eq("id", user.id);
    if (userDelError) {
      return NextResponse.json({ error: `Account konnte nicht gelöscht werden: ${userDelError.message}` }, { status: 500 });
    }

    return logoutResponse({ ok: true }, 200);
  } catch (error: any) {
    const msg = typeof error?.message === "string" ? error.message : "Unbekannter Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
