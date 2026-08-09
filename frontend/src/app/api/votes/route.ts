import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getErrorStatus } from "@/app/lib/unknownValue";
import {
  getQuestionByIdFromSupabase,
  voteOnQuestionInSupabase,
  voteOnQuestionOptionInSupabase,
  type VoteChoice,
} from "@/app/data/dbSupabase";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getFvSessionCookieOptions } from "@/app/lib/fvSessionCookie";
import { logAnalyticsEventServer } from "@/app/data/dbSupabaseAnalytics";
import { creditReferralVote } from "@/app/data/dbSupabaseReferrals";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";

export const revalidate = 0;

export async function POST(request: Request) {
  try {
    const invalidSource = mutationRequestGuard(request);
    if (invalidSource) return invalidSource;

    const body = (await request.json().catch(() => null)) as
      | { questionId?: string; choice?: unknown; optionId?: unknown }
      | null;
    const questionId = typeof body?.questionId === "string" ? body.questionId : null;
    const choiceRaw = body?.choice;
    const optionId = typeof body?.optionId === "string" ? body.optionId : null;

    const normalizedChoice = choiceRaw as VoteChoice;
    const hasChoice = normalizedChoice === "yes" || normalizedChoice === "no";
    const hasOption = typeof optionId === "string" && optionId.length > 0;

    if (!questionId) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    if ((hasChoice && hasOption) || (!hasChoice && !hasOption)) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const cookieStore = await cookies();
    const existingSession = cookieStore.get("fv_session")?.value;
    const sessionId = existingSession ?? randomUUID();

    // Optional: eingeloggten Nutzer fuer Profil-Statistiken ermitteln
    const userSessionId = cookieStore.get("fv_user")?.value;
    let userId: string | null = null;
    if (userSessionId) {
      const user = await getUserBySessionSupabase(userSessionId).catch(() => null);
      if (user?.id) {
        userId = user.id;
      }
    }

    const [globalRate, questionRate] = await Promise.all([
      consumeRateLimit({
        request,
        scope: "vote-global",
        identifier: userId ? `user:${userId}` : undefined,
        limit: userId ? 120 : 60,
        windowSeconds: 10 * 60,
      }),
      consumeRateLimit({
        request,
        scope: `vote-question:${questionId}`,
        identifier: userId ? `user:${userId}` : undefined,
        limit: userId ? 5 : 3,
        windowSeconds: 24 * 60 * 60,
      }),
    ]);
    const blockedRate = !globalRate.allowed ? globalRate : !questionRate.allowed ? questionRate : null;
    if (blockedRate) {
      await logAnalyticsEventServer({
        event: "rate_limit_vote",
        sessionId,
        userId,
        path: `/questions/${questionId ?? ""}`,
        meta: { retryAfterSeconds: blockedRate.retryAfterSeconds },
      });
      return rateLimitResponse(blockedRate, "Zu viele Abstimmungsversuche. Bitte später erneut versuchen.");
    }

    const existing = await getQuestionByIdFromSupabase(questionId, sessionId, userId);
    if (!existing) {
      return NextResponse.json({ error: "Question not found" }, { status: 404 });
    }

    const answerMode = existing.answerMode ?? "binary";
    if (answerMode === "options") {
      if (!hasOption) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
    } else {
      if (!hasChoice) {
        return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
      }
    }

    const result =
      answerMode === "options"
        ? await voteOnQuestionOptionInSupabase({ questionId, optionId: optionId!, sessionId, userId })
        : await voteOnQuestionInSupabase(questionId, normalizedChoice, sessionId, userId);

    const updated = result?.question ?? null;
    const alreadyVoted = Boolean(result?.alreadyVoted);
    if (!alreadyVoted) {
      await logAnalyticsEventServer({
        event: "vote_question",
        sessionId,
        userId,
        path: `/questions/${questionId}`,
        meta: answerMode === "options" ? { answerMode, optionId } : { answerMode, choice: normalizedChoice },
      });

      await creditReferralVote({ questionId, sessionId, viewerUserId: userId });
    }

    const response = NextResponse.json({ question: updated, alreadyVoted });
    response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
    return response;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    console.error("Vote failed:", message);
    const status = getErrorStatus(e);
    const publicMessage =
      status < 500 && message
        ? message
        : "Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut.";
    return NextResponse.json(
      { error: publicMessage },
      { status }
    );
  }
}
