export const SHARE_CHANNELS = [
  "share_menu",
  "native",
  "copy",
  "whatsapp",
  "telegram",
  "bluesky",
  "linkedin",
  "email",
  "qr",
] as const;

export type ShareChannel = (typeof SHARE_CHANNELS)[number];

export function isShareChannel(value: unknown): value is ShareChannel {
  return typeof value === "string" && SHARE_CHANNELS.includes(value as ShareChannel);
}

export function shareMedium(channel: ShareChannel): string {
  if (channel === "email") return "email";
  if (channel === "qr") return "qr";
  if (channel === "copy") return "copy";
  if (channel === "native" || channel === "share_menu") return "share";
  return "social";
}

export function addShareTracking(rawUrl: string, channel: ShareChannel, baseUrl?: string): string {
  try {
    const parsed = new URL(rawUrl, baseUrl);
    parsed.searchParams.set("utm_source", channel);
    parsed.searchParams.set("utm_medium", shareMedium(channel));
    parsed.searchParams.set("utm_campaign", "poll_share");
    return parsed.toString();
  } catch {
    return rawUrl;
  }
}
