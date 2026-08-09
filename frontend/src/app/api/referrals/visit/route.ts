import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifyReferralToken } from "@/app/lib/referrals";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getFvSessionCookieOptions } from "@/app/lib/fvSessionCookie";
import { consumeRateLimit, mutationRequestGuard } from "@/app/lib/requestSecurity";

export const revalidate = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeString(input: unknown, maxLen: number): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
}

function extractQuestionIdFromPath(path: string): string | null {
  const m = /^\/questions\/([^/?#]+)/.exec(path);
  if (!m) return null;
  const id = decodeURIComponent(m[1]);
  return id ? id.slice(0, 80) : null;
}

export async function POST(request: Request) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  const visitRate = await consumeRateLimit({
    request,
    scope: "referral-visit",
    identifier: `session:${sessionId}`,
    limit: 60,
    windowSeconds: 60 * 60,
  });
  if (!visitRate.allowed) {
    const response = NextResponse.json({ ok: true, throttled: true }, { status: 200 });
    if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
    return response;
  }

  const bodyRaw: unknown = await request.json().catch(() => null);
  const body = isRecord(bodyRaw) ? bodyRaw : {};

  const ref = normalizeString(body.ref, 260);
  const pagePath = normalizeString(body.path, 300);
  if (!ref) {
    const response = NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
    return response;
  }

  const verified = verifyReferralToken(ref);
  if (!verified.ok) {
    const response = NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
    return response;
  }

  const targetPath = verified.payload.t;
  // Optionaler Schutz: nur werten, wenn der Nutzer wirklich auf dieser Seite ist.
  if (pagePath && !pagePath.startsWith(targetPath)) {
    const response = NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
    return response;
  }

  const userSessionId = cookieStore.get("fv_user")?.value;
  let viewerUserId: string | null = null;
  if (userSessionId) {
    const user = await getUserBySessionSupabase(userSessionId).catch(() => null);
    if (user?.id) viewerUserId = user.id;
  }

  const sharerUserId = verified.payload.u;
  if (viewerUserId && viewerUserId === sharerUserId) {
    const response = NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
    return response;
  }

  const questionId = extractQuestionIdFromPath(targetPath);

  try {
    const supabase = getSupabaseAdminClient();

    // Dedupe: pro Session nur 1x pro Zielseite.
    const { data: existing, error: existingError } = await supabase
      .from("analytics_events")
      .select("id")
      .eq("event", "referral_visit")
      .eq("session_id", sessionId)
      .eq("path", targetPath)
      .limit(1);
    if (!existingError && (existing ?? []).length > 0) {
      const response = NextResponse.json({ ok: true, deduped: true }, { status: 200 });
      if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
      return response;
    }

    const { error } = await supabase.from("analytics_events").insert({
      event: "referral_visit",
      path: targetPath,
      referrer: null,
      session_id: sessionId,
      user_id: viewerUserId,
      meta: {
        sharerUserId,
        questionId,
      },
    });

    if (error) {
      console.warn("referral_visit insert failed", error);
    }
  } catch (e) {
    console.warn("referral_visit failed", e);
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
  return response;
}
