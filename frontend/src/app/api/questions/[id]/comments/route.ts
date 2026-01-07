import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQuestionByIdFromSupabase } from "@/app/data/dbSupabase";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { addQuestionComment, listQuestionComments, type CommentStance } from "@/app/data/dbSupabaseComments";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

const RATE_LIMIT_MS = 5000;
const lastCommentByUser = new Map<string, number>();

function isMissingRelation(error: unknown): boolean {
  const code = String((error as any)?.code ?? "");
  const msg = String((error as any)?.message ?? "").toLowerCase();
  return code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
}

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

    const commentIds = comments.map((c) => c.id).filter(Boolean);
    const supabase = getSupabaseAdminClient();

    const countsByCommentId = new Map<string, { upVotes: number; downVotes: number }>();
    if (commentIds.length > 0) {
      const { data: countRows, error: countsError } = await supabase
        .from("question_comment_vote_counts")
        .select("comment_id,up_votes,down_votes")
        .in("comment_id", commentIds);

      if (countsError && !isMissingRelation(countsError)) throw countsError;

      ((countRows ?? []) as any[]).forEach((r) => {
        const cid = String(r.comment_id ?? "");
        if (!cid) return;
        countsByCommentId.set(cid, {
          upVotes: Math.max(0, Number(r.up_votes ?? 0) || 0),
          downVotes: Math.max(0, Number(r.down_votes ?? 0) || 0),
        });
      });
    }

    const cookieStore = await cookies();
    const userSessionId = cookieStore.get("fv_user")?.value;
    const user = userSessionId ? await getUserBySessionSupabase(userSessionId).catch(() => null) : null;

    const myVoteByCommentId = new Map<string, "up" | "down">();
    if (user?.id && commentIds.length > 0) {
      const { data: myRows, error: myError } = await supabase
        .from("question_comment_votes")
        .select("comment_id,vote")
        .eq("user_id", user.id)
        .in("comment_id", commentIds);

      if (myError && !isMissingRelation(myError)) throw myError;
      ((myRows ?? []) as any[]).forEach((r) => {
        const cid = String(r.comment_id ?? "");
        const vote = r.vote === "down" ? "down" : "up";
        if (!cid) return;
        myVoteByCommentId.set(cid, vote);
      });
    }

    const merged = comments.map((c) => {
      const counts = countsByCommentId.get(c.id) ?? { upVotes: 0, downVotes: 0 };
      const myVote = myVoteByCommentId.get(c.id) ?? null;
      return { ...c, ...counts, myVote };
    });

    return NextResponse.json({ comments: merged }, { status: 200 });
  } catch (e: unknown) {
    const code = (e as any)?.code as string | undefined;
    if (code === "42P01") {
      return NextResponse.json(
        {
          error:
            "Supabase table/view fehlt. Fuehre supabase/question_comments.sql und supabase/question_comment_votes.sql aus.",
        },
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
    return NextResponse.json({ error: "Bitte zuerst E-Mail bestätigen." }, { status: 403 });
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
