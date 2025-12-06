import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDrafts, getQuestions, incrementViewsForAll } from "@/app/data/db";

export const revalidate = 0;

export async function GET() {
  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  incrementViewsForAll();
  const response = NextResponse.json({ questions: getQuestions(sessionId), drafts: getDrafts() });
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
