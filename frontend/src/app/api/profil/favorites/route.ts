import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { listFavoriteQuestions } from "@/app/data/dbSupabaseFavorites";

export const revalidate = 0;

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const user = await getUserBySessionSupabase(sessionId);
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  try {
    const favorites = await listFavoriteQuestions(user.id, 20);
    return NextResponse.json({ favorites }, { status: 200 });
  } catch (e: unknown) {
    console.warn("/api/profil/favorites failed", e);
    return NextResponse.json({ error: "Konnte Favoriten nicht laden." }, { status: 500 });
  }
}

