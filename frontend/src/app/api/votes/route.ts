import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getQuestionByIdFromSupabase,
  voteOnQuestionInSupabase,
  voteOnQuestionOptionInSupabase,
  type VoteChoice,
} from "@/app/data/dbSupabase";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getFvSessionCookieOptions } from "@/app/lib/fvSessionCookie";
import { logAnalyticsEventServer } from "@/app/data/dbSupabaseAnalytics";

const RATE_LIMIT_MS = 5000;
const lastVoteBySession = new Map<string, number>();

export const revalidate = 0;

function errorStatusForMessage(message: string): number {
  const msg = message.toLowerCase();
  if (
    msg.includes("ungueltig") ||
    msg.includes("ungültig") ||
    msg.includes("invalid payload") ||
    msg.includes("mindestens") ||
    msg.includes("option")
  ) {
    return 400;
  }
  return 500;
}

export async function POST(request: Request) {
  try {
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

    const now = Date.now();
    const lastVote = lastVoteBySession.get(sessionId) ?? 0;
    const diff = now - lastVote;
    if (diff < RATE_LIMIT_MS) {
      return NextResponse.json(
        { error: "Too Many Requests", retryAfterMs: RATE_LIMIT_MS - diff },
        { status: 429, headers: { "Retry-After": `${Math.ceil((RATE_LIMIT_MS - diff) / 1000)}` } }
      );
    }

    const existing = await getQuestionByIdFromSupabase(questionId, sessionId);
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

    const updated =
      answerMode === "options"
        ? await voteOnQuestionOptionInSupabase({ questionId, optionId: optionId!, sessionId, userId })
        : await voteOnQuestionInSupabase(questionId, normalizedChoice, sessionId, userId);
    lastVoteBySession.set(sessionId, now);

    await logAnalyticsEventServer({
      event: "vote_question",
      sessionId,
      userId,
      path: `/questions/${questionId}`,
      meta: answerMode === "options" ? { answerMode, optionId } : { answerMode, choice: normalizedChoice },
    });

    const response = NextResponse.json({ question: updated });
    response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
    return response;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unbekannter Fehler";
    console.error("Vote failed:", message);
    return NextResponse.json(
      { error: message || "Deine Stimme konnte nicht gespeichert werden. Bitte versuche es erneut." },
      { status: errorStatusForMessage(message || "") }
    );
  }
}
