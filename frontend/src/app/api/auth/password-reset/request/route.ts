import { NextResponse } from "next/server";
import { getUserByEmailSupabase } from "@/app/data/dbSupabaseUsers";
import { createPasswordResetTokenSupabase } from "@/app/data/dbSupabaseUsers";
import { sendPasswordResetEmail } from "@/app/lib/email";

export const revalidate = 0;

const RATE_LIMIT_MS = 60_000;
const lastRequestByKey = new Map<string, number>();

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Bitte gib eine gueltige E-Mail-Adresse ein." }, { status: 400 });
  }

  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const key = `${ip}|${email}`;

  const now = Date.now();
  const last = lastRequestByKey.get(key) ?? 0;
  const diff = now - last;
  if (diff < RATE_LIMIT_MS) {
    return NextResponse.json(
      { error: "Too Many Requests", retryAfterMs: RATE_LIMIT_MS - diff },
      { status: 429, headers: { "Retry-After": `${Math.ceil((RATE_LIMIT_MS - diff) / 1000)}` } }
    );
  }

  lastRequestByKey.set(key, now);

  try {
    const user = await getUserByEmailSupabase(email);

    if (user) {
      const token = await createPasswordResetTokenSupabase({ userId: user.id, ttlMinutes: 60 });
      const origin = new URL(request.url).origin;
      const resetUrl = `${origin}/auth/reset/${encodeURIComponent(token)}`;

      await sendPasswordResetEmail({
        to: user.email,
        displayName: user.displayName,
        resetUrl,
      });
    }

    // Immer die gleiche Antwort (keine Account-Enumeration)
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password reset request failed", error);
    return NextResponse.json({ error: "Passwort-Reset konnte nicht gestartet werden." }, { status: 500 });
  }
}