import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId).catch(() => null) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
  }

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const limitRaw = Number(body?.limit ?? 25);
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(60, Math.trunc(limitRaw))) : 25;

  const origin = new URL(request.url).origin;
  const target = new URL("/api/cron/resolution-suggestions", origin);
  target.searchParams.set("limit", String(limit));
  target.searchParams.set("source", "admin");

  const res = await fetch(target.toString(), {
    method: "GET",
    headers: { "x-vercel-cron": "1" },
    cache: "no-store",
  });

  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    return NextResponse.json({ error: json?.error ?? "Cron konnte nicht ausgeführt werden.", details: json }, { status: res.status });
  }

  return NextResponse.json(json);
}

