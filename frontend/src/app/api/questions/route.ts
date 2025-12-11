import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getDraftsFromSupabase,
  getQuestionsFromSupabase,
  incrementViewsForAllInSupabase,
} from "@/app/data/dbSupabase";

export const revalidate = 0;

export async function GET() {
  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  await incrementViewsForAllInSupabase();
  const [questions, drafts] = await Promise.all([
    getQuestionsFromSupabase(sessionId),
    getDraftsFromSupabase(),
  ]);
  const response = NextResponse.json({ questions, drafts });
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
