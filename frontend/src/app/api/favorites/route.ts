import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import {
  addFavoriteQuestion,
  listFavoriteQuestionIds,
  removeFavoriteQuestion,
  toggleFavoriteQuestion,
} from "@/app/data/dbSupabaseFavorites";

export const revalidate = 0;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) {
    return NextResponse.json({ favoriteIds: [] }, { status: 200 });
  }

  const user = await getUserBySessionSupabase(sessionId).catch(() => null);
  if (!user) {
    return NextResponse.json({ favoriteIds: [] }, { status: 200 });
  }

  const favoriteIds = await listFavoriteQuestionIds(user.id);
  return NextResponse.json({ favoriteIds }, { status: 200 });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const user = await getUserBySessionSupabase(sessionId).catch(() => null);
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const obj = isRecord(body) ? body : {};
  const questionId = typeof obj.questionId === "string" ? obj.questionId : "";
  const action = typeof obj.action === "string" ? obj.action : "toggle";

  if (!questionId) {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  try {
    if (action === "add") {
      await addFavoriteQuestion(user.id, questionId);
      return NextResponse.json({ ok: true, favorited: true }, { status: 200 });
    }
    if (action === "remove") {
      await removeFavoriteQuestion(user.id, questionId);
      return NextResponse.json({ ok: true, favorited: false }, { status: 200 });
    }

    const result = await toggleFavoriteQuestion(user.id, questionId);
    return NextResponse.json({ ok: true, ...result }, { status: 200 });
  } catch (e: unknown) {
    console.warn("/api/favorites failed", e);
    return NextResponse.json({ error: "Konnte Favorit nicht speichern." }, { status: 500 });
  }
}

