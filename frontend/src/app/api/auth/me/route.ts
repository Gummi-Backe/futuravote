import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) {
    return NextResponse.json({ user: null });
  }

  try {
    const user = await getUserBySessionSupabase(sessionId);
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({
      user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
    });
  } catch (error) {
    console.error("auth/me (Supabase) failed", error);
    return NextResponse.json({ user: null });
  }
}
