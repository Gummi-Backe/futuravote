import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getPollByShareIdFromSupabase, incrementViewsForQuestionInSupabase } from "@/app/data/dbSupabase";
import { getFvSessionCookieOptions } from "@/app/lib/fvSessionCookie";

export const revalidate = 0;

type Params = { params: Promise<{ shareId: string }> };

export async function GET(_: Request, context: Params) {
  const resolvedParams = await context.params;
  const shareId = (resolvedParams.shareId ?? "").trim();
  if (!shareId) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  const poll = await getPollByShareIdFromSupabase({ shareId, sessionId });
  if (!poll) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  if (poll.kind === "question") {
    try {
      await incrementViewsForQuestionInSupabase(poll.question.id);
      poll.question = { ...poll.question, views: (poll.question.views ?? 0) + 1 };
    } catch (err) {
      console.warn("Failed to increment views (share poll)", err);
    }
  }

  const response = NextResponse.json(poll, { status: 200 });
  response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());

  return response;
}
