import { NextResponse } from "next/server";
import { voteOnDraftInSupabase, type DraftReviewChoice } from "@/app/data/dbSupabase";

export const revalidate = 0;

type VoteBody = {
  draftId?: string;
  choice?: DraftReviewChoice;
};

export async function POST(request: Request) {
  let body: VoteBody;
  try {
    body = (await request.json()) as VoteBody;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const draftId = body.draftId?.trim();
  const choice = body.choice;

  if (!draftId) {
    return NextResponse.json({ error: "Draft-ID fehlt." }, { status: 400 });
  }
  if (choice !== "good" && choice !== "bad") {
    return NextResponse.json({ error: "Ungültige Auswahl." }, { status: 400 });
  }

  const draft = await voteOnDraftInSupabase(draftId, choice);
  if (!draft) {
    return NextResponse.json({ error: "Draft nicht gefunden." }, { status: 404 });
  }

  return NextResponse.json({ draft }, { status: 200 });
}

