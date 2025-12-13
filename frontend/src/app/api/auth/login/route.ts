import { NextResponse } from "next/server";
import crypto from "crypto";
import {
  createUserSessionSupabase,
  getUserByEmailSupabase,
  getUserPasswordHashByEmailSupabase,
} from "@/app/data/dbSupabaseUsers";

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

  try {
    const user = await getUserByEmailSupabase(trimmedEmail);
    if (!user || !user.id) {
      return NextResponse.json({ error: "E-Mail oder Passwort ist falsch." }, { status: 401 });
    }

    const passwordHash = await getUserPasswordHashByEmailSupabase(trimmedEmail);
    if (!passwordHash || !verifyPassword(password, passwordHash)) {
      return NextResponse.json({ error: "E-Mail oder Passwort ist falsch." }, { status: 401 });
    }

    const sessionId = await createUserSessionSupabase(user.id);
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName },
    });

    // Persistente Login-Session: Cookie bleibt auch nach Browser-Neustart erhalten,
    // bis der Nutzer sich aktiv ausloggt (oder die Session abgelaufen/geloescht wird).
    response.cookies.set("fv_user", sessionId, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30, // 30 Tage in Sekunden
    });

    return response;
  } catch (error) {
    console.error("Login (Supabase) failed", error);
    return NextResponse.json(
      { error: "Login ist fehlgeschlagen. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
