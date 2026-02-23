import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteUserSessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getFvUserClearCookieOptions } from "@/app/lib/fvUserCookie";

export const revalidate = 0;

function isLikelyIpAddress(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":");
}

function getCookieClearDomains(request: Request, resolvedDomain?: string): string[] {
  const domains = new Set<string>();
  const add = (value?: string) => {
    const normalized = String(value ?? "").trim().toLowerCase().replace(/^\./, "");
    if (!normalized) return;
    if (normalized === "localhost" || isLikelyIpAddress(normalized)) return;
    domains.add(normalized);
  };

  add(resolvedDomain);
  try {
    const host = new URL(request.url).hostname.toLowerCase();
    add(host);
    const parts = host.split(".");
    if (parts.length >= 2) {
      add(parts.slice(-2).join("."));
    }
  } catch {
    // ignore
  }

  return Array.from(domains);
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (sessionId) {
    try {
      await deleteUserSessionSupabase(sessionId);
    } catch (error) {
      console.error("logout session cleanup failed", error);
    }
  }

  const response = NextResponse.json({ success: true });
  const clearOptions = getFvUserClearCookieOptions(request);
  const { domain, ...baseClearOptions } = clearOptions as typeof clearOptions & { domain?: string };
  const clearWithExpiry = { ...baseClearOptions, maxAge: 0, expires: new Date(0) };

  // Host-only Cookie löschen.
  response.cookies.set("fv_user", "", clearWithExpiry);

  // Domain-gebundene Cookies für mehrere mögliche Varianten löschen.
  const domains = getCookieClearDomains(request, domain);
  for (const item of domains) {
    response.cookies.set("fv_user", "", { ...clearWithExpiry, domain: item });
  }

  return response;
}
