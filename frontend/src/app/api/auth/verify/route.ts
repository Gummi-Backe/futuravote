import { NextResponse } from "next/server";
import { verifyEmailByTokenSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/auth?verify=missing", request.url));
  }

  try {
    const user = await verifyEmailByTokenSupabase(token);
    if (!user) {
      return NextResponse.redirect(new URL("/auth?verify=invalid", request.url));
    }

    return NextResponse.redirect(new URL("/auth?verify=success", request.url));
  } catch (error) {
    console.error("E-Mail-Verifikation fehlgeschlagen", error);
    return NextResponse.redirect(new URL("/auth?verify=error", request.url));
  }
}

