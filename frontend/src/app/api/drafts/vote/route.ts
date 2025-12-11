import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySession } from "@/app/data/db";
import { voteOnDraftInSupabase, type DraftReviewChoice } from "@/app/data/dbSupabase";

export const revalidate = 0;

type VoteBody = {
  draftId?: string;
  choice?: DraftReviewChoice;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId || !getUserBySession(sessionId)) {
    return NextResponse.json(
      { error: "Bitte melde dich an, bevor du im Review-Bereich abstimmst." },
      { status: 401 }
    );
  }

  let body: VoteBody;
  try {
    body = (await request.json()) as VoteBody;
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const draftId = body.draftId?.trim();
  const choice = body.choice;

  if (!draftId) {
    return NextResponse.json({ error: "Draft-ID fehlt." }, { status: 400 });
  }
  if (choice !== "good" && choice !== "bad") {
    return NextResponse.json({ error: "Ungueltige Auswahl." }, { status: 400 });
  }

  const draft = await voteOnDraftInSupabase(draftId, choice);
  if (!draft) {
    return NextResponse.json({ error: "Draft nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ draft }, { status: 200 });
}
