import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { isRecord } from "@/app/lib/unknownValue";

export const revalidate = 0;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId).catch(() => null) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
  }

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

  const res = await fetch(target.toString(), {
    method: "GET",
    headers: { "x-vercel-cron": "1" },
    cache: "no-store",
  });

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
