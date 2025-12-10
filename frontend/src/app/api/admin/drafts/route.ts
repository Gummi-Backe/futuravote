import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminAcceptDraft, adminRejectDraft, getUserBySession } from "@/app/data/db";

export const revalidate = 0;

type AdminDraftBody = {
  draftId?: string;
  action?: "accept" | "reject";
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? getUserBySession(sessionId) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Nur Admins duerfen diese Aktion ausfuehren." },
      { status: 403 }
    );
  }

  let body: AdminDraftBody;
  try {
    body = (await request.json()) as AdminDraftBody;
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const draftId = body.draftId?.trim();
  const action = body.action;
  if (!draftId || (action !== "accept" && action !== "reject")) {
    return NextResponse.json({ error: "Draft-ID oder Aktion fehlt/ungueltig." }, { status: 400 });
  }

  const draft = action === "accept" ? adminAcceptDraft(draftId) : adminRejectDraft(draftId);
  if (!draft) {
    return NextResponse.json({ error: "Draft nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ draft });
}

