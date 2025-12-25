import "server-only";

import crypto from "crypto";

export type OAuthClientConfig = {
  clientId: string;
  clientSecret: string | null;
  allowedRedirectHosts: string[];
};

export function getOAuthClientConfig(): OAuthClientConfig {
  const clientId = (process.env.FV_GPT_OAUTH_CLIENT_ID ?? "futurevote_gpt").trim();
  const clientSecret = (process.env.FV_GPT_OAUTH_CLIENT_SECRET ?? "").trim() || null;
  const allowedRedirectHosts = [
    "chat.openai.com",
    "chatgpt.com",
  ];
  return { clientId, clientSecret, allowedRedirectHosts };
}

export function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function base64UrlSha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("base64url");
}

export function randomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

export function isAllowedRedirectUri(redirectUri: string, allowedHosts: string[]): boolean {
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== "https:") return false;
    if (!allowedHosts.includes(url.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function htmlPage(title: string, body: string): string {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: dark; }
    body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial; background:#0b1220; color:#e5e7eb; }
    .wrap { max-width: 720px; margin: 40px auto; padding: 0 16px; }
    .card { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 18px; padding: 18px; }
    .title { font-size: 18px; font-weight: 700; margin: 0 0 6px; }
    .muted { color: rgba(226,232,240,0.78); font-size: 13px; line-height: 1.35; }
    .row { display:flex; gap: 10px; flex-wrap: wrap; margin-top: 14px; }
    .btn { appearance:none; border-radius: 999px; border: 1px solid rgba(255,255,255,0.18); padding: 10px 14px; font-weight: 700; cursor:pointer; background: rgba(255,255,255,0.05); color: #fff; }
    .btn.primary { border-color: rgba(16,185,129,0.55); background: rgba(16,185,129,0.18); }
    .btn.danger { border-color: rgba(244,63,94,0.45); background: rgba(244,63,94,0.14); }
    code { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas; font-size: 12px; color: rgba(226,232,240,0.95); }
    .pill { display:inline-flex; gap:8px; align-items:center; padding: 6px 10px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.10); background: rgba(0,0,0,0.18); font-size: 12px; }
  </style>
</head>
<body>
  <div class="wrap">
    ${body}
  </div>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

