import { NextResponse } from "next/server";
import { getUserByEmailSupabase } from "@/app/data/dbSupabaseUsers";
import { createPasswordResetTokenSupabase } from "@/app/data/dbSupabaseUsers";
import { sendPasswordResetEmail } from "@/app/lib/email";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";

export const revalidate = 0;

export async function POST(request: Request) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  let body: { email?: string };
  try {
    body = (await request.json()) as { email?: string };
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const email = (body.email ?? "").trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }, { status: 400 });
  }

  const [ipRate, emailRate] = await Promise.all([
    consumeRateLimit({ request, scope: "password-reset-ip", limit: 5, windowSeconds: 60 * 60 }),
    consumeRateLimit({
      request,
      scope: "password-reset-email",
      identifier: `email:${email}`,
      limit: 3,
      windowSeconds: 60 * 60,
    }),
  ]);
  const blockedRate = !ipRate.allowed ? ipRate : !emailRate.allowed ? emailRate : null;
  if (blockedRate) {
    return rateLimitResponse(blockedRate, "Zu viele Anfragen. Bitte später erneut versuchen.");
  }

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
