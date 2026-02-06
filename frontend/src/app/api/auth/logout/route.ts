import { NextResponse } from "next/server";
import { getFvUserClearCookieOptions } from "@/app/lib/fvUserCookie";

export const revalidate = 0;

export async function POST(request: Request) {
  const response = NextResponse.json({ success: true });
  const clearOptions = getFvUserClearCookieOptions(request);

  response.cookies.set("fv_user", "", clearOptions);
  // Legacy host-only Cookie ebenfalls entfernen, falls vorhanden.
  if ("domain" in clearOptions) {
    const { domain: _domain, ...hostOnlyClear } = clearOptions;
    response.cookies.set("fv_user", "", hostOnlyClear);
  }

  return response;
}
