import { NextResponse } from "next/server";

export const revalidate = 0;

export async function POST() {
  const response = NextResponse.json({ success: true });

  response.cookies.set("fv_user", "", {
    path: "/",
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });

  return response;
}
