import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQuestionByIdFromSupabase } from "@/app/data/dbSupabase";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { addQuestionComment, listQuestionComments, type CommentStance } from "@/app/data/dbSupabaseComments";

export const revalidate = 0;

const RATE_LIMIT_MS = 5000;
const lastCommentByUser = new Map<string, number>();

function normalizeStance(input: unknown): CommentStance {
  return input === "yes" || input === "no" || input === "neutral" ? input : "neutral";
}

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

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const resolved = await props.params;
  const id = resolved?.id;
  if (!id) return NextResponse.json({ error: "ID fehlt." }, { status: 400 });

  const question = await getQuestionByIdFromSupabase(id).catch(() => null);
  if (!question || question.visibility !== "public") {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }

  try {
    const comments = await listQuestionComments(id, 80);
    return NextResponse.json({ comments }, { status: 200 });
  } catch (e: unknown) {
    const code = (e as any)?.code as string | undefined;
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Supabase table 'question_comments' fehlt. Fuehre supabase/question_comments.sql aus." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Kommentare konnten nicht geladen werden." }, { status: 500 });
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
  if (!user.emailVerified) {
    return NextResponse.json({ error: "Bitte zuerst E-Mail bestaetigen." }, { status: 403 });
  }

  const now = Date.now();
  const last = lastCommentByUser.get(user.id) ?? 0;
  const diff = now - last;
  if (diff < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: "Bitte kurz warten.", retryAfterMs: RATE_LIMIT_MS - diff },
      { status: 429, headers: { "Retry-After": `${Math.ceil((RATE_LIMIT_MS - diff) / 1000)}` } }
    );
  }

  const body = (await request.json().catch(() => null)) as any;
  const text = typeof body?.body === "string" ? body.body.trim() : "";
  const stance = normalizeStance(body?.stance);
  const sourceUrl = normalizeSourceUrl(body?.sourceUrl);

  if (text.length < 5) {
    return NextResponse.json({ error: "Kommentar ist zu kurz." }, { status: 400 });
  }
  if (text.length > 2000) {
    return NextResponse.json({ error: "Kommentar ist zu lang (max. 2000 Zeichen)." }, { status: 400 });
  }

  try {
    const comment = await addQuestionComment({
      questionId,
      userId: user.id,
      stance,
      body: text,
      sourceUrl,
    });
    lastCommentByUser.set(user.id, now);
    return NextResponse.json({ ok: true, comment }, { status: 200 });
  } catch (e: unknown) {
    const code = (e as any)?.code as string | undefined;
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Supabase table 'question_comments' fehlt. Fuehre supabase/question_comments.sql aus." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Kommentar konnte nicht gespeichert werden." }, { status: 500 });
  }
}

