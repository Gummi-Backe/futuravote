import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQuestionById, voteOnQuestion, type VoteChoice } from "@/app/data/db";

const RATE_LIMIT_MS = 5000;
const lastVoteBySession = new Map<string, number>();

export const revalidate = 0;

export async function POST(request: Request) {
  const { questionId, choice } = await request.json();
  const normalizedChoice = choice as VoteChoice;

  if (!questionId || (normalizedChoice !== "yes" && normalizedChoice !== "no")) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  const now = Date.now();
  const lastVote = lastVoteBySession.get(sessionId) ?? 0;
  const diff = now - lastVote;
  if (diff < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: "Too Many Requests", retryAfterMs: RATE_LIMIT_MS - diff },
      { status: 429, headers: { "Retry-After": `${Math.ceil((RATE_LIMIT_MS - diff) / 1000)}` } }
    );
  }

  const existing = getQuestionById(questionId, sessionId);
  if (!existing) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const updated = voteOnQuestion(questionId, normalizedChoice, sessionId);
  lastVoteBySession.set(sessionId, now);
  const response = NextResponse.json({ question: updated });
  if (!existingSession) {
    response.cookies.set("fv_session", sessionId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}
