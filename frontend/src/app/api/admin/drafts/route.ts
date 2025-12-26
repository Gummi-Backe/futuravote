import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import {
  adminAcceptDraftInSupabase,
  adminDeleteDraftInSupabase,
  adminRejectDraftInSupabase,
} from "@/app/data/dbSupabase";

export const revalidate = 0;

type AdminDraftBody = {
  draftId?: string;
  action?: "accept" | "reject" | "delete";
};

export async function GET() {
  return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
}
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Nur Admins dürfen diese Aktion ausführen." },
      { status: 403 }
    );
  }

  let body: AdminDraftBody;
  try {
    body = (await request.json()) as AdminDraftBody;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const draftId = body.draftId?.trim();
  const action = body.action;
  if (!draftId || !action) {
    return NextResponse.json({ error: "Draft-ID oder Aktion fehlt/ungültig." }, { status: 400 });
  }

  let draft;
  if (action === "accept") {
    draft = await adminAcceptDraftInSupabase(draftId);
  } else if (action === "reject") {
    draft = await adminRejectDraftInSupabase(draftId);
  } else if (action === "delete") {
    draft = await adminDeleteDraftInSupabase(draftId);
  } else {
    return NextResponse.json({ error: "Unbekannte Admin-Aktion." }, { status: 400 });
  }
  if (!draft) {
    return NextResponse.json({ error: "Draft nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ draft });
}
