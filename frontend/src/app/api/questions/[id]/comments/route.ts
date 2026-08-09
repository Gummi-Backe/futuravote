import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQuestionByIdFromSupabase } from "@/app/data/dbSupabase";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { addQuestionComment, listQuestionComments, type CommentStance } from "@/app/data/dbSupabaseComments";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { logAnalyticsEventServer } from "@/app/data/dbSupabaseAnalytics";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";
import { getErrorCode, getErrorMessage, isRecord } from "@/app/lib/unknownValue";

export const revalidate = 0;

function isMissingRelation(error: unknown): boolean {
  const code = getErrorCode(error);
  const msg = getErrorMessage(error, "").toLowerCase();
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

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const debug = new URL(request.url).searchParams.get("debug") === "1";
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
      try {
        const { data: countRows, error: countsError } = await supabase
          .from("question_comment_vote_counts")
          .select("comment_id,up_votes,down_votes")
          .in("comment_id", commentIds);

        if (countsError) {
          // Kommentar-Counts sind optional: ohne diese Tabelle/View sollen Kommentare trotzdem laden.
          if (!isMissingRelation(countsError)) {
            console.warn("comment vote counts query failed:", getErrorMessage(countsError));
          }
        } else {
          ((countRows ?? []) as Array<{ comment_id: string | null; up_votes: number | null }>).forEach((r) => {
            const cid = String(r.comment_id ?? "");
            if (!cid) return;
            countsByCommentId.set(cid, {
              upVotes: Math.max(0, Number(r.up_votes ?? 0) || 0),
              downVotes: 0,
            });
          });
        }
      } catch (err) {
        // Optional: niemals Kommentare blockieren
        console.warn("comment vote counts threw:", getErrorMessage(err));
      }
    }

    const cookieStore = await cookies();
    const userSessionId = cookieStore.get("fv_user")?.value;
    const user = userSessionId ? await getUserBySessionSupabase(userSessionId).catch(() => null) : null;

    const myVoteByCommentId = new Map<string, "up">();
    if (user?.id && commentIds.length > 0) {
      try {
        const { data: myRows, error: myError } = await supabase
          .from("question_comment_votes")
          .select("comment_id,vote")
          .eq("user_id", user.id)
          .in("comment_id", commentIds);

        if (myError) {
          if (!isMissingRelation(myError)) {
            console.warn("comment vote myVote query failed:", getErrorMessage(myError));
          }
        } else {
          ((myRows ?? []) as Array<{ comment_id: string | null; vote: string | null }>).forEach((r) => {
            const cid = String(r.comment_id ?? "");
            const vote = r.vote === "up" ? "up" : null;
            if (!cid) return;
            if (vote) myVoteByCommentId.set(cid, vote);
          });
        }
      } catch (err) {
        console.warn("comment vote myVote threw:", getErrorMessage(err));
      }
    }

    const merged = comments.map((c) => {
      const counts = countsByCommentId.get(c.id) ?? { upVotes: 0, downVotes: 0 };
      const myVote = myVoteByCommentId.get(c.id) ?? null;
      return { ...c, ...counts, myVote };
    });

    return NextResponse.json({ comments: merged }, { status: 200 });
  } catch (e: unknown) {
    const code = getErrorCode(e);
    if (code === "42P01") {
      return NextResponse.json(
        {
          error:
            "Supabase table/view fehlt. Führe supabase/question_comments.sql und supabase/question_comment_votes.sql aus.",
        },
        { status: 500 }
      );
    }
    if (debug) {
      return NextResponse.json(
        {
          error: "Kommentare konnten nicht geladen werden.",
          code: getErrorCode(e) || null,
          details: getErrorMessage(e),
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Kommentare konnten nicht geladen werden." }, { status: 500 });
  }
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

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

  const [burstRate, dailyRate] = await Promise.all([
    consumeRateLimit({
      request,
      scope: "comment-create-burst",
      identifier: `user:${user.id}`,
      limit: 1,
      windowSeconds: 5,
    }),
    consumeRateLimit({
      request,
      scope: "comment-create-daily",
      identifier: `user:${user.id}`,
      limit: 30,
      windowSeconds: 24 * 60 * 60,
    }),
  ]);
  const blockedRate = !burstRate.allowed ? burstRate : !dailyRate.allowed ? dailyRate : null;
  if (blockedRate) {
    await logAnalyticsEventServer({
      event: "rate_limit_comment",
      sessionId: sessionId,
      userId: user.id,
      path: `/questions/${questionId}`,
      meta: { retryAfterSeconds: blockedRate.retryAfterSeconds },
    });
    return rateLimitResponse(blockedRate, "Zu viele Kommentare. Bitte später erneut versuchen.");
  }

  const rawBody: unknown = await request.json().catch(() => null);
  const body = isRecord(rawBody) ? rawBody : {};
  const text = typeof body.body === "string" ? body.body.trim() : "";
  const stance = normalizeStance(body.stance);
  const sourceUrl = normalizeSourceUrl(body.sourceUrl);

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
    return NextResponse.json({ ok: true, comment }, { status: 200 });
  } catch (e: unknown) {
    const code = getErrorCode(e);
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Supabase table 'question_comments' fehlt. Führe supabase/question_comments.sql aus." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Kommentar konnte nicht gespeichert werden." }, { status: 500 });
  }
}
