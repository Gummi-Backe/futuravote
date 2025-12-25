import { NextResponse } from "next/server";

type RateState = {
  count: number;
  resetAt: number;
  lastSeenAt: number;
};

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;
const GC_AFTER_MS = 10 * 60_000;

const rateMap = new Map<string, RateState>();

function getClientIp(request: Request): string {
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp =
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-client-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

function gcRateMap(now: number) {
  for (const [key, value] of rateMap.entries()) {
    if (now - value.lastSeenAt > GC_AFTER_MS) {
      rateMap.delete(key);
    }
  }
}

export function guardGptRateLimit(request: Request): NextResponse | null {
  const now = Date.now();
  gcRateMap(now);

  const ip = getClientIp(request);
  const key = `gpt:${ip}`;

  const existing = rateMap.get(key);
  if (!existing || now >= existing.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS, lastSeenAt: now });
    return null;
  }

  existing.lastSeenAt = now;
  existing.count += 1;

  if (existing.count <= RATE_LIMIT_MAX) {
    return null;
  }

  const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
  return NextResponse.json(
    {
      error: "Rate limit erreicht. Bitte kurz warten und erneut versuchen.",
      retryAfterSeconds: retryAfterSec,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(retryAfterSec),
      },
    }
  );
}

export function withCacheHeaders(res: NextResponse, seconds: number) {
  res.headers.set("Cache-Control", `public, s-maxage=${seconds}, stale-while-revalidate=${seconds * 6}`);
  return res;
}

