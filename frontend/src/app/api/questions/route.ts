import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getDraftsPageFromSupabase,
  getQuestionsPageFromSupabase,
  incrementViewsForAllInSupabase,
} from "@/app/data/dbSupabase";

export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") ?? undefined;
  const category = searchParams.get("category");
  const region = searchParams.get("region");
  const pageSizeParam = searchParams.get("pageSize");
  const questionsOffsetParam = searchParams.get("questionsOffset");
  const draftsOffsetParam = searchParams.get("draftsOffset");

  const pageSize = Math.min(
    Math.max(Number(pageSizeParam) || 16, 4),
    64
  );
  const questionsOffset = Math.max(Number(questionsOffsetParam) || 0, 0);
  const draftsOffset = Math.max(Number(draftsOffsetParam) || 0, 0);

  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  await incrementViewsForAllInSupabase();
  const [questionsPage, draftsPage] = await Promise.all([
    getQuestionsPageFromSupabase({
      sessionId,
      limit: pageSize,
      offset: questionsOffset,
      tab,
      category,
      region,
    }),
    getDraftsPageFromSupabase({
      limit: pageSize,
      offset: draftsOffset,
      category,
      region,
      status: "open",
    }),
  ]);
  const response = NextResponse.json({
    questions: questionsPage.items,
    drafts: draftsPage.items,
    questionsTotal: questionsPage.total,
    draftsTotal: draftsPage.total,
  });
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
