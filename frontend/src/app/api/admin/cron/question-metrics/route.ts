import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { isRecord } from "@/app/lib/unknownValue";
import { getCronSecret } from "@/app/lib/cronAuth";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";
import { GET as runQuestionMetrics } from "@/app/api/cron/question-metrics/route";

export const revalidate = 0;

export async function POST(request: Request) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId).catch(() => null) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
  }

  const rate = await consumeRateLimit({ request, scope: "admin-cron", identifier: `user:${user.id}`, limit: 30, windowSeconds: 60 * 60 });
  if (!rate.allowed) return rateLimitResponse(rate, "Limit erreicht. Bitte spaeter erneut versuchen.");
  const secret = getCronSecret();
  if (!secret) return NextResponse.json({ error: "CRON_SECRET ist nicht gesetzt." }, { status: 503 });

  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const daysBackRaw = Number(isRecord(body) ? body.daysBack ?? 120 : 120);
  const daysBack = Number.isFinite(daysBackRaw) ? Math.max(1, Math.min(3650, Math.trunc(daysBackRaw))) : 120;

  const origin = new URL(request.url).origin;
  const target = new URL("/api/cron/question-metrics", origin);
  target.searchParams.set("daysBack", String(daysBack));
  target.searchParams.set("source", "admin");

  const res = await runQuestionMetrics(new Request(target.toString(), {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  }));

  const json: unknown = await res.json().catch(() => null);
  const jsonData = isRecord(json) ? json : {};
  if (!res.ok) {
    return NextResponse.json(
      { error: typeof jsonData.error === "string" ? jsonData.error : "Cron konnte nicht ausgeführt werden.", details: json },
      { status: res.status }
    );
  }

  return NextResponse.json(json);
}
