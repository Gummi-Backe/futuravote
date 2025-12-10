import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createUserSession, getUserByEmail } from "@/app/data/db";
import crypto from "crypto";

export const revalidate = 0;

function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computed, "hex"));
}

export async function POST(request: Request) {
  const { email, password } = (await request.json()) as { email?: string; password?: string };

  const trimmedEmail = (email ?? "").trim().toLowerCase();
  if (!trimmedEmail || !password) {
    return NextResponse.json({ error: "Bitte E-Mail und Passwort eingeben." }, { status: 400 });
  }

  const user = getUserByEmail(trimmedEmail);
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return NextResponse.json({ error: "E-Mail oder Passwort ist falsch." }, { status: 401 });
  }

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

