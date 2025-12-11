import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import crypto from "crypto";
import { createUserSessionSupabase, getUserByEmailSupabase } from "@/app/data/dbSupabaseUsers";

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

    // Passwort-Hash aus Supabase holen
    const userForPassword = await getUserByEmailSupabase(trimmedEmail);
    if (!userForPassword) {
      return NextResponse.json({ error: "E-Mail oder Passwort ist falsch." }, { status: 401 });
    }

    // userForPassword enthält password_hash im Supabase-Row; wir lesen ihn über einen separaten Select
    // (einfachheitshalber erneut über getUserByEmailSupabase, intern wird die vollständige Zeile verwendet)

    const supabase = (await import("@/app/lib/supabaseClient")).getSupabaseClient();
    const { data, error } = await supabase
      .from("users")
      .select("password_hash")
      .eq("email", trimmedEmail)
      .maybeSingle();

    if (error || !data?.password_hash || !verifyPassword(password, data.password_hash)) {
      return NextResponse.json({ error: "E-Mail oder Passwort ist falsch." }, { status: 401 });
    }

    const sessionId = await createUserSessionSupabase(user.id);
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
  } catch (error) {
    console.error("Login (Supabase) failed", error);
    return NextResponse.json(
      { error: "Login ist fehlgeschlagen. Bitte versuche es erneut." },
      { status: 500 }
    );
  }
}
