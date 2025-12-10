import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const revalidate = 0;

export async function POST() {
  const response = NextResponse.json({ success: true });
  const cookieStore = await cookies();
  const existing = cookieStore.get("fv_user");

  if (existing) {
    cookieStore.set("fv_user", "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
  }

  return response;
}

