import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQuestionById, voteOnQuestion, type VoteChoice } from "@/app/data/store";

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

  const existing = await getQuestionById(questionId, sessionId);
  if (!existing) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const updated = await voteOnQuestion(questionId, normalizedChoice, sessionId);
  const response = NextResponse.json({ question: updated });
  if (!existingSession) {
    response.cookies.set("fv_session", sessionId, { path: "/", httpOnly: true, sameSite: "lax" });
  }
  return response;
}
