import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

type ReferralPayloadV1 = {
  v: 1;
  u: string; // sharer userId
  t: string; // target path (e.g. /questions/...)
  iat: number; // unix seconds
  n: string; // nonce
};

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecodeToBuffer(input: string): Buffer | null {
  if (typeof input !== "string" || !input) return null;
  const normalized = input.replaceAll("-", "+").replaceAll("_", "/");
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + "=".repeat(padLen);
  try {
    return Buffer.from(padded, "base64");
  } catch {
    return null;
  }
}

function getReferralSecret(): string {
  const explicit = process.env.FV_REFERRAL_SECRET?.trim();
  if (explicit) return explicit;
  // Fallback: nutzt vorhandenes Server-Secret, damit die Funktion ohne Extra-Config läuft.
  // (Wird nicht an den Client geleakt, nur zum Signieren/Prüfen verwendet.)
  const fallback = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!fallback) throw new Error("FV_REFERRAL_SECRET fehlt");
  return fallback;
}

function sign(payloadB64: string): string {
  const secret = getReferralSecret();
  const sig = createHmac("sha256", secret).update(payloadB64).digest();
  return base64UrlEncode(sig);
}

export function createReferralToken(options: { sharerUserId: string; targetPath: string }): string {
  const sharerUserId = String(options.sharerUserId ?? "").trim();
  const targetPath = String(options.targetPath ?? "").trim();
  if (!sharerUserId) throw new Error("sharerUserId fehlt");
  if (!targetPath.startsWith("/")) throw new Error("targetPath ungültig");

  const payload: ReferralPayloadV1 = {
    v: 1,
    u: sharerUserId,
    t: targetPath.slice(0, 300),
    iat: Math.floor(Date.now() / 1000),
    n: base64UrlEncode(randomBytes(8)),
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sigB64 = sign(payloadB64);
  return `${payloadB64}.${sigB64}`;
}

export function verifyReferralToken(
  token: string,
  options?: { maxAgeSeconds?: number }
): { ok: true; payload: ReferralPayloadV1 } | { ok: false; reason: string } {
  const raw = String(token ?? "").trim();
  const parts = raw.split(".");
  if (parts.length !== 2) return { ok: false, reason: "format" };

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return { ok: false, reason: "format" };

  const expected = sign(payloadB64);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sigB64, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "sig" };

  const payloadBuf = base64UrlDecodeToBuffer(payloadB64);
  if (!payloadBuf) return { ok: false, reason: "payload" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(payloadBuf.toString("utf8"));
  } catch {
    return { ok: false, reason: "payload" };
  }

  const p = parsed as Partial<ReferralPayloadV1>;
  if (p.v !== 1) return { ok: false, reason: "version" };
  const u = String(p.u ?? "").trim();
  const t = String(p.t ?? "").trim();
  const iat = Number(p.iat);
  const n = String(p.n ?? "").trim();
  if (!u || !t.startsWith("/") || !Number.isFinite(iat) || !n) return { ok: false, reason: "payload" };

  const maxAge = Math.max(60, Math.min(60 * 60 * 24 * 60, Math.floor(options?.maxAgeSeconds ?? 60 * 60 * 24 * 14)));
  const now = Math.floor(Date.now() / 1000);
  if (iat > now + 60) return { ok: false, reason: "time" };
  if (now - iat > maxAge) return { ok: false, reason: "expired" };

  return { ok: true, payload: { v: 1, u, t: t.slice(0, 300), iat, n } };
}

