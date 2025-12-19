import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQuestionByIdFromSupabase } from "@/app/data/dbSupabase";
import { getFvSessionCookieOptions } from "@/app/lib/fvSessionCookie";

export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Params) {
  const resolvedParams = await context.params;
  const { id } = resolvedParams;
  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  const question = await getQuestionByIdFromSupabase(id, sessionId);
  if (!question) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }
  if (question.visibility === "link_only") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const response = NextResponse.json({ question });
  response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
  return response;
}
