import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getDraftsPageFromSupabase,
  getQuestionsPageFromSupabase,
} from "@/app/data/dbSupabase";
import { getFvSessionCookieOptions } from "@/app/lib/fvSessionCookie";

export const revalidate = 0;

type IncludeMode = "both" | "questions" | "drafts";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") ?? undefined;
  const category = searchParams.get("category");
  const region = searchParams.get("region");
  const qRaw = searchParams.get("q");
  const q =
    typeof qRaw === "string" && qRaw.trim().length >= 2 ? qRaw.trim().slice(0, 80) : null;

  const include = (searchParams.get("include") as IncludeMode | null) ?? "both";
  const includeQuestions = include !== "drafts";
  const includeDrafts = include !== "questions";

  const pageSizeParam = searchParams.get("pageSize");
  const questionsOffsetParam = searchParams.get("questionsOffset");
  const draftsOffsetParam = searchParams.get("draftsOffset");

  const questionsCursor = searchParams.get("questionsCursor");
  const draftsCursor = searchParams.get("draftsCursor");

  const pageSize = Math.min(Math.max(Number(pageSizeParam) || 16, 1), 64);
  const questionsOffset = Math.max(Number(questionsOffsetParam) || 0, 0);
  const draftsOffset = Math.max(Number(draftsOffsetParam) || 0, 0);

  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  const [questionsPage, draftsPage] = await Promise.all([
    includeQuestions
      ? getQuestionsPageFromSupabase({
          sessionId,
          limit: pageSize,
          offset: questionsOffset,
          cursor: questionsCursor,
          tab,
          category,
          region,
          query: q,
        })
      : Promise.resolve({ items: [], total: 0, nextCursor: null }),
    includeDrafts
      ? getDraftsPageFromSupabase({
          limit: pageSize,
          offset: draftsOffset,
          cursor: draftsCursor,
          category,
          region,
          status: "open",
          query: q,
        })
      : Promise.resolve({ items: [], total: 0, nextCursor: null }),
  ]);

  const response = NextResponse.json({
    questions: includeQuestions ? questionsPage.items : [],
    drafts: includeDrafts ? draftsPage.items : [],
    questionsTotal: includeQuestions ? questionsPage.total : null,
    draftsTotal: includeDrafts ? draftsPage.total : null,
    questionsNextCursor: includeQuestions ? questionsPage.nextCursor : null,
    draftsNextCursor: includeDrafts ? draftsPage.nextCursor : null,
  });

  response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());

  return response;
}
