import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQuestionByIdFromSupabase, incrementViewsForQuestionInSupabase } from "@/app/data/dbSupabase";
import { getFvSessionCookieOptions } from "@/app/lib/fvSessionCookie";
import { consumeRateLimit, mutationRequestGuard } from "@/app/lib/requestSecurity";

export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Params) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  const resolvedParams = await context.params;
  const id = (resolvedParams?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "ID fehlt." }, { status: 400 });

  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  const viewRate = await consumeRateLimit({
    request,
    scope: `question-view:${id}`,
    identifier: `session:${sessionId}`,
    limit: 1,
    windowSeconds: 30 * 60,
  });
  if (!viewRate.allowed) {
    const response = NextResponse.json({ ok: true, skipped: true });
    if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
    return response;
  }

  const question = await getQuestionByIdFromSupabase(id).catch(() => null);
  if (!question || question.visibility !== "public") {
    return NextResponse.json({ ok: false, error: "Nicht gefunden." }, { status: 404 });
  }

  try {
    await incrementViewsForQuestionInSupabase(id);
  } catch (err) {
    console.warn("Failed to increment views", err);
  }

  const response = NextResponse.json({ ok: true });
  if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
  return response;
}
