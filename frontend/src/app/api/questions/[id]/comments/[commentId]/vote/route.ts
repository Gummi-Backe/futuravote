import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getQuestionByIdFromSupabase } from "@/app/data/dbSupabase";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";
import { getErrorCode, getErrorMessage, isRecord } from "@/app/lib/unknownValue";

export const revalidate = 0;

type VoteValue = "up";

function normalizeVote(input: unknown): VoteValue | null {
  return input === "up" ? input : null;
}

function isMissingRelation(error: unknown): boolean {
  const code = getErrorCode(error);
  const msg = getErrorMessage(error, "").toLowerCase();
  return code === "42P01" || msg.includes("does not exist") || msg.includes("schema cache");
}

async function getCountsForComment(commentId: string) {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("question_comment_vote_counts")
    .select("comment_id,up_votes,down_votes")
    .eq("comment_id", commentId)
    .maybeSingle();

  if (!error) {
    const row = data as { up_votes: number | null } | null;
    return {
      upVotes: Math.max(0, Number(row?.up_votes ?? 0) || 0),
      downVotes: 0,
    };
  }

  if (!isMissingRelation(error)) {
    throw error;
  }

  // Fallback: wenn die View fehlt (oder der Schema-Cache noch nicht aktualisiert ist)
  const { data: rows, error: rowsError } = await supabase
    .from("question_comment_votes")
    .select("vote")
    .eq("comment_id", commentId);

  if (rowsError) throw rowsError;

  let upVotes = 0;
  ((rows ?? []) as Array<{ vote: string | null }>).forEach((r) => {
    if (r.vote === "up") upVotes += 1;
  });

  return { upVotes, downVotes: 0 };
}

export async function POST(request: Request, props: { params: Promise<{ id: string; commentId: string }> }) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  const resolved = await props.params;
  const questionId = resolved?.id;
  const commentId = resolved?.commentId;
  if (!questionId || !commentId) {
    return NextResponse.json({ error: "ID fehlt." }, { status: 400 });
  }

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

  const voteRate = await consumeRateLimit({
    request,
    scope: "comment-vote",
    identifier: `user:${user.id}`,
    limit: 120,
    windowSeconds: 10 * 60,
  });
  if (!voteRate.allowed) {
    return rateLimitResponse(voteRate, "Zu viele Kommentarbewertungen. Bitte später erneut versuchen.");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const vote = normalizeVote(isRecord(body) ? body.vote : null);
  if (!vote) return NextResponse.json({ error: "Ungültige Stimme." }, { status: 400 });

  const supabase = getSupabaseAdminClient();

  // Sicherstellen, dass der Kommentar zu dieser Frage gehört (und existiert)
  const { data: commentRow, error: commentError } = await supabase
    .from("question_comments")
    .select("id,question_id")
    .eq("id", commentId)
    .maybeSingle();

  if (commentError) {
    const code = getErrorCode(commentError);
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Supabase table 'question_comments' fehlt. Führe supabase/question_comments.sql aus." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Kommentar nicht gefunden." }, { status: 404 });
  }

  if (!commentRow || String((commentRow as { question_id: string | null }).question_id) !== questionId) {
    return NextResponse.json({ error: "Kommentar nicht gefunden." }, { status: 404 });
  }

  try {
    const { data: existing, error: existingError } = await supabase
      .from("question_comment_votes")
      .select("vote")
      .eq("comment_id", commentId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingError) throw existingError;

    const existingVote = (existing as { vote: string | null } | null)?.vote === "up" ? ("up" as const) : null;
    const nowIso = new Date().toISOString();

    if (existingVote === vote) {
      const { error: delErr } = await supabase
        .from("question_comment_votes")
        .delete()
        .eq("comment_id", commentId)
        .eq("user_id", user.id);
      if (delErr) throw delErr;
    } else {
      const { error: upsertErr } = await supabase
        .from("question_comment_votes")
        .upsert(
          {
            comment_id: commentId,
            user_id: user.id,
            vote,
            updated_at: nowIso,
          },
          { onConflict: "comment_id,user_id" }
        );
      if (upsertErr) throw upsertErr;
    }

    const counts = await getCountsForComment(commentId);
    const myVote: VoteValue | null = existingVote === vote ? null : "up";

    return NextResponse.json({ ok: true, ...counts, myVote }, { status: 200 });
  } catch (e: unknown) {
    const code = getErrorCode(e);
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Supabase table 'question_comment_votes' fehlt. Führe supabase/question_comment_votes.sql aus." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Vote konnte nicht gespeichert werden." }, { status: 500 });
  }
}
