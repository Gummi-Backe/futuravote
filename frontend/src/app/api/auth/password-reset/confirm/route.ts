import { NextResponse } from "next/server";
import crypto from "crypto";
import { resetPasswordByTokenSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100_000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

export async function POST(request: Request) {
  let body: { token?: string; password?: string; passwordConfirm?: string };
  try {
    body = (await request.json()) as { token?: string; password?: string; passwordConfirm?: string };
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const token = (body.token ?? "").trim();
  const password = body.password ?? "";
  const passwordConfirm = body.passwordConfirm ?? "";

  if (!token) {
    return NextResponse.json({ error: "Token fehlt." }, { status: 400 });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "Das Passwort muss mindestens 8 Zeichen lang sein." }, { status: 400 });
  }
  if (password !== passwordConfirm) {
    return NextResponse.json({ error: "Die Passwoerter stimmen nicht ueberein." }, { status: 400 });
  }

  try {
    const newPasswordHash = hashPassword(password);
    const result = await resetPasswordByTokenSupabase({ token, newPasswordHash });

    if (!result.ok) {
      return NextResponse.json(
        { error: "Der Link ist ungueltig oder abgelaufen." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Password reset confirm failed", error);
    return NextResponse.json({ error: "Passwort konnte nicht zurueckgesetzt werden." }, { status: 500 });
  }
}