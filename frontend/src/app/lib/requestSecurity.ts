import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { isTrustedMutationSource } from "@/app/lib/requestSecurityCore";

type RateLimitOptions = {
  request: Request;
  scope: string;
  identifier?: string | null;
  limit: number;
  windowSeconds: number;
};

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type FallbackBucket = {
  count: number;
  resetAt: number;
};

const fallbackBuckets = new Map<string, FallbackBucket>();
let warnedAboutMissingRateLimitRpc = false;

function firstForwardedValue(value: string | null): string | null {
  const first = value?.split(",")[0]?.trim();
  return first || null;
}

export function getClientIp(request: Request): string {
  return (
    firstForwardedValue(request.headers.get("x-forwarded-for")) ??
    firstForwardedValue(request.headers.get("x-real-ip")) ??
    "unknown"
  );
}

function getRateLimitPepper(): string {
  return (
    process.env.FV_RATE_LIMIT_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.FV_CRON_SECRET?.trim() ||
    "futurevote-rate-limit-v1"
  );
}

function hashRateLimitKey(raw: string): string {
  return createHash("sha256").update(`${getRateLimitPepper()}:${raw}`).digest("hex");
}

function consumeFallbackBucket(keyHash: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  if (fallbackBuckets.size >= 5_000) {
    for (const [key, bucket] of fallbackBuckets) {
      if (bucket.resetAt <= now) fallbackBuckets.delete(key);
    }
    while (fallbackBuckets.size >= 5_000) {
      const oldestKey = fallbackBuckets.keys().next().value as string | undefined;
      if (!oldestKey) break;
      fallbackBuckets.delete(oldestKey);
    }
  }
  const current = fallbackBuckets.get(keyHash);
  if (!current || current.resetAt <= now) {
    fallbackBuckets.set(keyHash, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export async function consumeRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const limit = Math.max(1, Math.floor(options.limit));
  const windowSeconds = Math.max(1, Math.floor(options.windowSeconds));
  const identifier = options.identifier?.trim() || `ip:${getClientIp(options.request)}`;
  const keyHash = hashRateLimitKey(`${options.scope}:${identifier}`);

  try {
    const supabase = getSupabaseAdminClient();
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key_hash: keyHash,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    if (row && typeof row.allowed === "boolean") {
      return {
        allowed: row.allowed,
        retryAfterSeconds: Math.max(0, Number(row.retry_after_seconds) || 0),
      };
    }
  } catch (error) {
    if (!warnedAboutMissingRateLimitRpc) {
      warnedAboutMissingRateLimitRpc = true;
      console.warn("Persistentes Rate-Limit nicht verfuegbar; nutze temporaeren Fallback.", error);
    }
  }

  return consumeFallbackBucket(keyHash, limit, windowSeconds);
}

export function rateLimitResponse(result: RateLimitResult, message = "Zu viele Anfragen. Bitte spaeter erneut versuchen.") {
  return NextResponse.json(
    { error: message, retryAfterSeconds: result.retryAfterSeconds },
    {
      status: 429,
      headers: { "Retry-After": String(Math.max(1, result.retryAfterSeconds)) },
    }
  );
}

export function mutationRequestGuard(request: Request, options?: { allowBearer?: boolean }): NextResponse | null {
  if (options?.allowBearer) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth.toLowerCase().startsWith("bearer ")) return null;
  }

  if (!isTrustedMutationSource({
    requestUrl: request.url,
    origin: request.headers.get("origin"),
    secFetchSite: request.headers.get("sec-fetch-site"),
    configuredOrigins: [process.env.NEXT_PUBLIC_BASE_URL, process.env.FV_TRUSTED_ORIGINS],
  })) {
    return NextResponse.json({ error: "Ungueltige Anfragequelle." }, { status: 403 });
  }
  return null;
}
