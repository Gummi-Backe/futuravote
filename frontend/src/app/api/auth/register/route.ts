import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createUser, createUserSession, getUserByEmail } from "@/app/data/db";
import crypto from "crypto";

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
    return NextResponse.json({ error: "Bitte gib eine gueltige E-Mail-Adresse ein." }, { status: 400 });
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

  const existing = getUserByEmail(trimmedEmail);
  if (existing) {
    return NextResponse.json(
      { error: "Es existiert bereits ein Account mit dieser E-Mail-Adresse." },
      { status: 400 }
    );
  }

  const passwordHash = hashPassword(password);
  const user = createUser({ email: trimmedEmail, passwordHash, displayName: trimmedName });
  const sessionId = createUserSession(user.id);

  const response = NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });

  const cookieStore = await cookies();
  cookieStore.set("fv_user", sessionId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

