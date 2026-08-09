import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getErrorCode } from "@/app/lib/unknownValue";
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

function normalizeMeta(input: unknown): Record<string, unknown> | null {
  if (!isRecord(input)) return null;
  // keep it small
  const out: Record<string, unknown> = {};
  let count = 0;
  for (const [k, v] of Object.entries(input)) {
    if (!k || k.length > 40) continue;
    if (count >= 20) break;
    const key = k.slice(0, 40);
    if (typeof v === "string") out[key] = v.slice(0, 200);
    else if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
    else if (typeof v === "boolean") out[key] = v;
    count++;
  }
  return Object.keys(out).length ? out : null;
}

export async function POST(request: Request) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  const analyticsRate = await consumeRateLimit({
    request,
    scope: "analytics-event",
    identifier: `session:${sessionId}`,
    limit: 120,
    windowSeconds: 10 * 60,
  });
  if (!analyticsRate.allowed) {
    const response = NextResponse.json({ ok: true, throttled: true }, { status: 200 });
    if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
    return response;
  }

  const bodyRaw: unknown = await request.json().catch(() => null);
  const body = isRecord(bodyRaw) ? bodyRaw : {};

  const event = normalizeString(body.event, 80);
  const path = normalizeString(body.path, 300);
  const referrer = normalizeString(body.referrer, 300);
  const meta = normalizeMeta(body.meta);

  if (!event) {
    const response = NextResponse.json({ ok: true, ignored: true }, { status: 200 });
    if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
    return response;
  }

  // Optional: eingeloggten Nutzer speichern (fuer Admin-Kontext)
  const userSessionId = cookieStore.get("fv_user")?.value;
  let userId: string | null = null;
  if (userSessionId) {
    const user = await getUserBySessionSupabase(userSessionId).catch(() => null);
    if (user?.id) userId = user.id;
  }

  try {
    const supabase = getSupabaseAdminClient();
    const { error } = await supabase.from("analytics_events").insert({
      event,
      path,
      referrer,
      session_id: sessionId,
      user_id: userId,
      meta,
    });

    if (error) {
      const code = getErrorCode(error);
      if (code === "42P01") {
        const response = NextResponse.json(
          { ok: false, error: "Supabase table 'analytics_events' fehlt. Fuehre supabase/analytics_events.sql aus." },
          { status: 500 }
        );
        if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
        return response;
      }
      // Analytics darf nie user-facing brechen
      console.warn("analytics insert failed", error);
    }
  } catch (e) {
    console.warn("analytics failed", e);
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  if (!existingSession) response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
  return response;
}
