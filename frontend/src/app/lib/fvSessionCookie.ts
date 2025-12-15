export const FV_SESSION_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365; // 1 Jahr

export function getFvSessionCookieOptions() {
  return {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    maxAge: FV_SESSION_COOKIE_MAX_AGE_SECONDS,
  };
}

