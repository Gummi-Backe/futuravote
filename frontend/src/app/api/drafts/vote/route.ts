import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getErrorStatus } from "@/app/lib/unknownValue";
import { voteOnDraftInSupabase, type DraftReviewChoice } from "@/app/data/dbSupabase";
import { logAnalyticsEventServer } from "@/app/data/dbSupabaseAnalytics";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getFvSessionCookieOptions } from "@/app/lib/fvSessionCookie";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";

export const revalidate = 0;

type VoteBody = {
  draftId?: string;
  choice?: DraftReviewChoice;
};

function revalidatePublicDiscoveryPaths(questionId?: string) {
  revalidatePath("/sitemap.xml");
  revalidatePath("/");
  revalidatePath("/questions");
  revalidatePath("/archiv");
  if (questionId) {
    revalidatePath(`/questions/${encodeURIComponent(questionId)}`);
  }
}

export async function POST(request: Request) {
  try {
    const invalidSource = mutationRequestGuard(request);
    if (invalidSource) return invalidSource;

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
    const userSessionId = cookieStore.get("fv_user")?.value;
    const user = userSessionId ? await getUserBySessionSupabase(userSessionId).catch(() => null) : null;
    if (!user) {
      return NextResponse.json({ error: "Für Community-Reviews ist eine Anmeldung erforderlich." }, { status: 401 });
    }
    if (!user.emailVerified) {
      return NextResponse.json({ error: "Bitte bestätige zuerst deine E-Mail-Adresse." }, { status: 403 });
    }

    const rate = await consumeRateLimit({
      request,
      scope: "draft-review",
      identifier: `user:${user.id}`,
      limit: 40,
      windowSeconds: 60 * 60,
    });
    if (!rate.allowed) return rateLimitResponse(rate, "Zu viele Reviews. Bitte später erneut versuchen.");

    const { draft, alreadyVoted } = await voteOnDraftInSupabase(draftId, choice, sessionId, user.id);
    if (!draft) {
      return NextResponse.json({ error: "Draft nicht gefunden." }, { status: 404 });
    }

    if (!alreadyVoted) {
      await logAnalyticsEventServer({
        event: "review_draft",
        sessionId,
        userId: user.id,
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
    const status = getErrorStatus(err);
    const technicalMessage = err instanceof Error ? err.message : "Unbekannter Fehler";
    console.error("Draft review failed:", technicalMessage);
    const publicMessage =
      status < 500 && technicalMessage
        ? technicalMessage
        : "Draft-Review fehlgeschlagen. Bitte versuche es erneut.";
    return NextResponse.json({ error: publicMessage }, { status });
  }
}
