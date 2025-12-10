import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySession } from "@/app/data/db";

export const revalidate = 0;

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) {
    return NextResponse.json({ user: null });
  }
  const user = getUserBySession(sessionId);
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: { id: user.id, email: user.email, displayName: user.displayName },
  });
}

