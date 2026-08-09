import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createEmailVerificationTokenSupabase,
  getUserBySessionSupabase,
} from "@/app/data/dbSupabaseUsers";
import { sendVerificationEmail } from "@/app/lib/email";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";

export const revalidate = 0;

export async function POST(request: Request) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;

  if (!sessionId) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  try {
    const user = await getUserBySessionSupabase(sessionId);
    if (!user) {
      return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
    }

    if (user.emailVerified) {
      return NextResponse.json({ ok: true, alreadyVerified: true });
    }

    const resendRate = await consumeRateLimit({
      request,
      scope: "verification-resend",
      identifier: `user:${user.id}`,
      limit: 3,
      windowSeconds: 60 * 60,
    });
    if (!resendRate.allowed) {
      return rateLimitResponse(resendRate, "Zu viele E-Mails angefordert. Bitte später erneut versuchen.");
    }

    const token = await createEmailVerificationTokenSupabase(user.id);
    const origin = new URL(request.url).origin;
    const verificationUrl = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;

    await sendVerificationEmail({
      to: user.email,
      displayName: user.displayName,
      verificationUrl,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Resend verification failed", error);
    return NextResponse.json(
      { error: "Verifikationslink konnte nicht gesendet werden." },
      { status: 500 }
    );
  }
}
