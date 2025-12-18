import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  createUserSessionSupabase,
  createUserSupabase,
  getUserByEmailSupabase,
  hasAdminUserSupabase,
  type UserRole,
} from "@/app/data/dbSupabaseUsers";
import { createEmailVerificationTokenSupabase } from "@/app/data/dbSupabaseUsers";
import { sendVerificationEmail } from "@/app/lib/email";
import { logAnalyticsEventServer } from "@/app/data/dbSupabaseAnalytics";

export const revalidate = 0;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export async function POST(request: Request) {
  const { email, password, displayName } = (await request.json()) as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  const trimmedEmail = (email ?? "").trim().toLowerCase();
  const trimmedName = (displayName ?? "").trim();

  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    return NextResponse.json({ error: "Bitte gib eine gültige E-Mail-Adresse ein." }, { status: 400 });
  }
  if (!trimmedName || trimmedName.length < 3) {
    return NextResponse.json(
      { error: "Bitte gib einen Anzeige-Namen mit mindestens 3 Zeichen ein." },
      { status: 400 }
    );
  }
  if (!password || password.length < 8) {
    return NextResponse.json(
      { error: "Das Passwort muss mindestens 8 Zeichen lang sein." },
      { status: 400 }
    );
  }

  try {
    const existing = await getUserByEmailSupabase(trimmedEmail);
    if (existing) {
      return NextResponse.json(
        { error: "Es existiert bereits ein Account mit dieser E-Mail-Adresse." },
        { status: 400 }
      );
    }

    const passwordHash = hashPassword(password);

    const adminEmailEnv = process.env.FV_ADMIN_EMAIL?.trim().toLowerCase();
    let role: UserRole = "user";
    if (adminEmailEnv && adminEmailEnv === trimmedEmail) {
      role = "admin";
    } else if (!adminEmailEnv && !(await hasAdminUserSupabase())) {
      // Wenn noch kein Admin existiert und keine spezielle Admin-E-Mail konfiguriert ist,
      // wird der erste angelegte Account Admin.
      role = "admin";
    }

    const user = await createUserSupabase({
      email: trimmedEmail,
      passwordHash,
      displayName: trimmedName,
      role,
    });

    // Verifikations-Token erzeugen und E-Mail (oder Log) versenden
    try {
      const token = await createEmailVerificationTokenSupabase(user.id);
      const verificationUrl = new URL(`/api/auth/verify?token=${encodeURIComponent(token)}`, request.url).toString();
      await sendVerificationEmail({
        to: user.email,
        displayName: user.displayName,
        verificationUrl,
      });
    } catch (verificationError) {
      console.error("Konnte Verifikations-E-Mail nicht senden:", verificationError);
      // Registrierung soll trotzdem funktionieren; Verifikation kann spaeter erneut angestossen werden.
    }
    const sessionId = await createUserSessionSupabase(user.id);

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        emailVerified: user.emailVerified,
      },
    });

    await logAnalyticsEventServer({
      event: "register",
      sessionId,
      userId: user.id,
      path: "/auth",
    });

    response.cookies.set("fv_user", sessionId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch (error) {
    console.error("Register (Supabase) failed", error);
    return NextResponse.json(
      { error: "Registrierung ist fehlgeschlagen. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
