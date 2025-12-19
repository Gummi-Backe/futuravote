import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQuestionByIdFromSupabase, incrementViewsForQuestionInSupabase } from "@/app/data/dbSupabase";
import { getFvSessionCookieOptions } from "@/app/lib/fvSessionCookie";

export const revalidate = 0;

type Params = { params: Promise<{ id: string }> };

const VIEW_TTL_MS = 30 * 60 * 1000;
const lastViewBySession = new Map<string, number>();

export async function POST(_request: Request, context: Params) {
  const resolvedParams = await context.params;
  const id = (resolvedParams?.id ?? "").trim();
  if (!id) return NextResponse.json({ ok: false, error: "ID fehlt." }, { status: 400 });

  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  const cacheKey = `${sessionId}:${id}`;
  const now = Date.now();
  const last = lastViewBySession.get(cacheKey) ?? 0;
  if (now - last < VIEW_TTL_MS) {
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
    lastViewBySession.set(cacheKey, now);
  } catch (err) {
    console.warn("Failed to increment views", err);
  }

  const response = NextResponse.json({ ok: true });
  if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
  return response;
}

