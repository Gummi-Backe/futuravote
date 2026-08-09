"use client";

import { isRecord } from "@/app/lib/unknownValue";
import { addShareTracking, type ShareChannel } from "@/app/lib/shareChannels";

function isShareableTarget(targetPath: string): boolean {
  return targetPath.startsWith("/questions/") || targetPath.startsWith("/p/");
}

export async function resolveShareUrl(url: string, channel: ShareChannel): Promise<string> {
  const origin = window.location.origin;
  try {
    const parsed = new URL(url, origin);
    const targetPath = parsed.pathname;
    if (!isShareableTarget(targetPath)) return addShareTracking(url, channel, origin);

    const response = await fetch("/api/referrals/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetPath, channel }),
    });
    if (!response.ok) return addShareTracking(url, channel, origin);

    const parsedResponse: unknown = await response.json().catch(() => null);
    const json = isRecord(parsedResponse) ? parsedResponse : {};
    const referralUrl = typeof json.url === "string" ? json.url : url;
    return addShareTracking(referralUrl, channel, origin);
  } catch {
    return addShareTracking(url, channel, origin);
  }
}
