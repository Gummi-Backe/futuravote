import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getUserBySessionSupabase,
  updateUserDefaultRegionSupabase,
} from "@/app/data/dbSupabaseUsers";

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
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        defaultRegion: user.defaultRegion,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt ?? null,
      },
    });
  } catch (error) {
    console.error("auth/me (Supabase) failed", error);
    return NextResponse.json({ user: null });
  }
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const currentUser = await getUserBySessionSupabase(sessionId);
  if (!currentUser) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  let region: string | null = null;
  try {
    const body = (await request.json()) as { region?: string | null };
    if (typeof body.region === "string") {
      const trimmed = body.region.trim();
      region = trimmed.length > 0 ? trimmed.slice(0, 100) : null;
    } else if (body.region === null) {
      region = null;
    }
  } catch {
    // Ungültiger Body -> Region nicht ändern
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  try {
    const updated = await updateUserDefaultRegionSupabase(currentUser.id, region);

    return NextResponse.json({
      user: {
        id: updated.id,
        email: updated.email,
        displayName: updated.displayName,
        role: updated.role,
        defaultRegion: updated.defaultRegion,
        createdAt: updated.createdAt ?? null,
      },
    });
  } catch (error) {
    console.error("auth/me PATCH (defaultRegion) failed", error);
    return NextResponse.json({ error: "Region konnte nicht gespeichert werden." }, { status: 500 });
  }
}
