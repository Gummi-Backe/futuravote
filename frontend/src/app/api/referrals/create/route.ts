import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { createReferralToken } from "@/app/lib/referrals";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

function getBaseUrlFromHeaders(headerStore: Headers): string {
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  if (host) return `${protocol}://${host}`;
  return process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de";
}

function normalizeTargetPath(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return null;
  // nur interne Seiten erlauben
  if (!(trimmed.startsWith("/questions/") || trimmed.startsWith("/p/"))) return null;
  return trimmed.slice(0, 300);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userSessionId = cookieStore.get("fv_user")?.value;
  if (!userSessionId) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });

  const currentUser = await getUserBySessionSupabase(userSessionId).catch(() => null);
  if (!currentUser?.id) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });

  const bodyRaw: unknown = await request.json().catch(() => null);
  const body = (bodyRaw && typeof bodyRaw === "object" ? (bodyRaw as Record<string, unknown>) : {}) as Record<string, unknown>;

  const targetPath = normalizeTargetPath(body.targetPath);
  if (!targetPath) return NextResponse.json({ error: "Ungültige Ziel-URL." }, { status: 400 });

  let token: string;
  try {
    token = createReferralToken({ sharerUserId: currentUser.id, targetPath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Referral konnte nicht erstellt werden." }, { status: 500 });
  }

  const headerStore = await headers();
  const baseUrl = getBaseUrlFromHeaders(headerStore);
  const sep = targetPath.includes("?") ? "&" : "?";
  const fullUrl = `${baseUrl}${targetPath}${sep}fv_ref=${encodeURIComponent(token)}`;

  return NextResponse.json({ ok: true, url: fullUrl }, { status: 200 });
}

