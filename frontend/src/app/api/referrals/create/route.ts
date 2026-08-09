import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { createReferralToken } from "@/app/lib/referrals";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";
import { isShareChannel, shareMedium, type ShareChannel } from "@/app/lib/shareChannels";

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

function addQueryParams(path: string, params: Array<[string, string]>): string {
  const [pathname, hash = ""] = path.split("#", 2);
  const separator = pathname.includes("?") ? "&" : "?";
  const query = params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  const hashed = hash ? `#${hash}` : "";
  return `${pathname}${separator}${query}${hashed}`;
}

export async function POST(request: Request) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  const cookieStore = await cookies();
  const userSessionId = cookieStore.get("fv_user")?.value;
  if (!userSessionId) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });

  const currentUser = await getUserBySessionSupabase(userSessionId).catch(() => null);
  if (!currentUser?.id) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });

  const referralRate = await consumeRateLimit({
    request,
    scope: "referral-create",
    identifier: `user:${currentUser.id}`,
    limit: 60,
    windowSeconds: 60 * 60,
  });
  if (!referralRate.allowed) {
    return rateLimitResponse(referralRate, "Zu viele Freigabelinks. Bitte später erneut versuchen.");
  }

  const bodyRaw: unknown = await request.json().catch(() => null);
  const body = (bodyRaw && typeof bodyRaw === "object" ? (bodyRaw as Record<string, unknown>) : {}) as Record<string, unknown>;

  const targetPath = normalizeTargetPath(body.targetPath);
  const channel: ShareChannel = isShareChannel(body.channel) ? body.channel : "share_menu";
  if (!targetPath) return NextResponse.json({ error: "Ungültige Ziel-URL." }, { status: 400 });

  let token: string;
  try {
    token = createReferralToken({ sharerUserId: currentUser.id, targetPath });
  } catch (error: unknown) {
    console.error("Referral token creation failed", error);
    return NextResponse.json({ error: "Freigabelink konnte nicht erstellt werden." }, { status: 500 });
  }

  const headerStore = await headers();
  const baseUrl = getBaseUrlFromHeaders(headerStore);
  const utmContent = targetPath.startsWith("/p/") ? "private_question" : "public_question";
  const targetWithParams = addQueryParams(targetPath, [
    ["fv_ref", token],
    ["utm_source", channel],
    ["utm_medium", shareMedium(channel)],
    ["utm_campaign", "poll_share"],
    ["utm_content", utmContent],
  ]);
  const fullUrl = `${baseUrl}${targetWithParams}`;

  return NextResponse.json({ ok: true, url: fullUrl }, { status: 200 });
}
