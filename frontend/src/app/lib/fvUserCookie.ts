export const FV_USER_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 Tage

function resolveCookieDomain(request: Request): string | undefined {
  const forced = process.env.FV_COOKIE_DOMAIN?.trim();
  if (forced) return forced;

  try {
    const host = new URL(request.url).hostname.toLowerCase();
    if (host === "future-vote.de" || host.endsWith(".future-vote.de")) {
      return ".future-vote.de";
    }
  } catch {
    // Fallback: ohne Domain bleibt das Cookie host-only.
  }

  return undefined;
}

export function getFvUserCookieOptions(request: Request) {
  const domain = resolveCookieDomain(request);
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: FV_USER_COOKIE_MAX_AGE_SECONDS,
    ...(domain ? { domain } : {}),
  };
}

export function getFvUserClearCookieOptions(request: Request) {
  const domain = resolveCookieDomain(request);
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
    ...(domain ? { domain } : {}),
  };
}
