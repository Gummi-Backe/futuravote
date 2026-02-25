import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { voteOnDraftInSupabase, type DraftReviewChoice } from "@/app/data/dbSupabase";
import { logAnalyticsEventServer } from "@/app/data/dbSupabaseAnalytics";
import { getFvSessionCookieOptions } from "@/app/lib/fvSessionCookie";

export const revalidate = 0;

type VoteBody = {
  draftId?: string;
  choice?: DraftReviewChoice;
};

function revalidatePublicDiscoveryPaths(questionId?: string) {
  revalidatePath("/sitemap.xml");
  revalidatePath("/");
  revalidatePath("/archiv");
  if (questionId) {
    revalidatePath(`/questions/${encodeURIComponent(questionId)}`);
  }
}

export async function POST(request: Request) {
  try {
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

    const cookieStore = await cookies();
    const existingSession = cookieStore.get("fv_session")?.value;
    const sessionId = existingSession ?? randomUUID();

    const { draft, alreadyVoted } = await voteOnDraftInSupabase(draftId, choice, sessionId);
    if (!draft) {
      return NextResponse.json({ error: "Draft nicht gefunden." }, { status: 404 });
    }

    if (!alreadyVoted) {
      await logAnalyticsEventServer({
        event: "review_draft",
        sessionId,
        path: "/",
        meta: { draftId, choice },
      });

      if (draft.status === "accepted") {
        const questionId = draft.id.startsWith("q_") ? draft.id : `q_${draft.id}`;
        revalidatePublicDiscoveryPaths(questionId);
      }
    }

    const response = NextResponse.json({ draft, alreadyVoted }, { status: 200 });
    response.cookies.set("fv_session", sessionId, getFvSessionCookieOptions());
    return response;
  } catch (err: unknown) {
    const status =
      typeof (err as any)?.status === "number" && Number.isFinite((err as any).status)
        ? (err as any).status
        : 500;
    const message =
      err instanceof Error && err.message ? err.message : "Draft-Review fehlgeschlagen. Bitte versuche es erneut.";
    return NextResponse.json({ error: message }, { status });
  }
}
