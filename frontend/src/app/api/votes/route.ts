import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getQuestionByIdFromSupabase,
  voteOnQuestionInSupabase,
  type VoteChoice,
} from "@/app/data/dbSupabase";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getFvSessionCookieOptions } from "@/app/lib/fvSessionCookie";

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

  const updated = await voteOnQuestionInSupabase(questionId, normalizedChoice, sessionId, userId);
  lastVoteBySession.set(sessionId, now);
  const response = NextResponse.json({ question: updated });
  response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
  return response;
}
