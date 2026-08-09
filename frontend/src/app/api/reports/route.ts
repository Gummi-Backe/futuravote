import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getErrorCode } from "@/app/lib/unknownValue";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getFvSessionCookieOptions } from "@/app/lib/fvSessionCookie";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";

export const revalidate = 0;

type ReportKind = "question" | "draft";
type ReportReason = "spam" | "abuse" | "hate" | "misinfo" | "copyright" | "other";

type ReportBody = {
  kind?: ReportKind;
  itemId?: string;
  itemTitle?: string;
  shareId?: string | null;
  reason?: ReportReason;
  message?: string | null;
  pageUrl?: string | null;
};

export async function POST(request: Request) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  let body: ReportBody;
  try {
    body = (await request.json()) as ReportBody;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const kind = body.kind;
  const itemId = body.itemId?.trim();
  const itemTitle = (body.itemTitle ?? "").trim().slice(0, 180) || null;
  const shareId = typeof body.shareId === "string" ? body.shareId.trim().slice(0, 80) : null;
  const reason = body.reason;
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 1000) : null;
  const pageUrl = typeof body.pageUrl === "string" ? body.pageUrl.trim().slice(0, 500) : null;

  if (kind !== "question" && kind !== "draft") {
    return NextResponse.json({ error: "Ungültiger Typ." }, { status: 400 });
  }
  if (!itemId) {
    return NextResponse.json({ error: "ID fehlt." }, { status: 400 });
  }
  if (!reason || !["spam", "abuse", "hate", "misinfo", "copyright", "other"].includes(reason)) {
    return NextResponse.json({ error: "Ungültiger Grund." }, { status: 400 });
  }

  const cookieStore = await cookies();
  const existingSession = cookieStore.get("fv_session")?.value;
  const sessionId = existingSession ?? randomUUID();

  // Optional: eingeloggten Nutzer speichern (fuer Admin-Kontext), aber Melden ist auch ohne Login erlaubt.
  const userSessionId = cookieStore.get("fv_user")?.value;
  let reporterUserId: string | null = null;
  if (userSessionId) {
    const user = await getUserBySessionSupabase(userSessionId).catch(() => null);
    if (user?.id) reporterUserId = user.id;
  }

  const reportRate = await consumeRateLimit({
    request,
    scope: "report-create",
    identifier: reporterUserId ? `user:${reporterUserId}` : undefined,
    limit: reporterUserId ? 20 : 6,
    windowSeconds: 24 * 60 * 60,
  });
  if (!reportRate.allowed) {
    return rateLimitResponse(reportRate, "Zu viele Meldungen. Bitte später erneut versuchen.");
  }

  const supabase = getSupabaseAdminClient();

  const { error: insertError } = await supabase.from("reports").insert({
    kind,
    item_id: itemId,
    item_title: itemTitle,
    share_id: shareId,
    reason,
    message,
    page_url: pageUrl,
    reporter_session_id: sessionId,
    reporter_user_id: reporterUserId,
    status: "open",
  });

  if (insertError) {
    const code = getErrorCode(insertError);
    if (code === "23505") {
      const response = NextResponse.json({ ok: true, duplicate: true }, { status: 200 });
      response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
      return response;
    }
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Supabase table 'reports' fehlt. Fuehre supabase/reports.sql aus." },
        { status: 500 }
      );
    }
    console.error("Report konnte nicht gespeichert werden:", insertError);
    return NextResponse.json({ error: "Meldung konnte nicht gespeichert werden." }, { status: 500 });
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
  return response;
}
