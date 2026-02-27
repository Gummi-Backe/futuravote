import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQuestionByIdFromSupabase } from "@/app/data/dbSupabase";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { addQuestionUpdate, listQuestionUpdates } from "@/app/data/dbSupabaseQuestionUpdates";

export const revalidate = 0;

const MIN_UPDATE_CHARS = 10;
const MAX_UPDATE_CHARS = 8000;

function normalizeSourceUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isMissingRelation(error: unknown): boolean {
  const typed = error as { code?: string; message?: string } | null;
  const code = String(typed?.code ?? "");
  const msg = String(typed?.message ?? "").toLowerCase();
  return code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
}

export async function GET(_: Request, props: { params: Promise<{ id: string }> }) {
  const resolved = await props.params;
  const questionId = resolved?.id;
  if (!questionId) return NextResponse.json({ error: "ID fehlt." }, { status: 400 });

  const question = await getQuestionByIdFromSupabase(questionId).catch(() => null);
  if (!question || question.visibility !== "public") {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  try {
    const updates = await listQuestionUpdates(questionId, 80);
    return NextResponse.json({ updates }, { status: 200 });
  } catch (error: unknown) {
    if (isMissingRelation(error)) {
      return NextResponse.json(
        { error: "Supabase table 'question_updates' fehlt. Führe supabase/question_updates.sql aus." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Updates konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const resolved = await props.params;
  const questionId = resolved?.id;
  if (!questionId) return NextResponse.json({ error: "ID fehlt." }, { status: 400 });

  const question = await getQuestionByIdFromSupabase(questionId).catch(() => null);
  if (!question || question.visibility !== "public") {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) return NextResponse.json({ error: "Bitte einloggen." }, { status: 401 });

  const user = await getUserBySessionSupabase(sessionId).catch(() => null);
  if (!user) return NextResponse.json({ error: "Bitte einloggen." }, { status: 401 });

  if (!question.creatorId || question.creatorId !== user.id) {
    return NextResponse.json(
      { error: "Nur der Ersteller dieser Frage darf Updates veröffentlichen." },
      { status: 403 }
    );
  }

  const payload = (await request.json().catch(() => null)) as { body?: unknown; sourceUrl?: unknown } | null;
  const text = typeof payload?.body === "string" ? payload.body.trim() : "";
  const sourceUrl = normalizeSourceUrl(payload?.sourceUrl);

  if (text.length < MIN_UPDATE_CHARS) {
    return NextResponse.json(
      { error: `Update ist zu kurz (mind. ${MIN_UPDATE_CHARS} Zeichen).` },
      { status: 400 }
    );
  }
  if (text.length > MAX_UPDATE_CHARS) {
    return NextResponse.json(
      { error: `Update ist zu lang (max. ${MAX_UPDATE_CHARS} Zeichen).` },
      { status: 400 }
    );
  }

  try {
    const update = await addQuestionUpdate({
      questionId,
      userId: user.id,
      body: text,
      sourceUrl,
    });
    return NextResponse.json({ ok: true, update }, { status: 200 });
  } catch (error: unknown) {
    if (isMissingRelation(error)) {
      return NextResponse.json(
        { error: "Supabase table 'question_updates' fehlt. Führe supabase/question_updates.sql aus." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Update konnte nicht gespeichert werden." }, { status: 500 });
  }
}
