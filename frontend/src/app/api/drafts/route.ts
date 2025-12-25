import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getUserByOauthAccessTokenSupabase } from "@/app/data/dbSupabaseOauth";
import { createDraftInSupabase, createLinkOnlyQuestionInSupabase } from "@/app/data/dbSupabase";
import type { AnswerMode, PollVisibility } from "@/app/data/mock";
import { logAnalyticsEventServer } from "@/app/data/dbSupabaseAnalytics";

export const revalidate = 0;

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de";
}

type DraftInput = {
  title?: string;
  description?: string;
  category?: string;
  region?: string;
  imageUrl?: string;
  imageCredit?: string;
  timeLeftHours?: number;
  closesAt?: string;
  visibility?: PollVisibility;
  answerMode?: AnswerMode;
  isResolvable?: boolean;
  options?: string[];
  resolutionCriteria?: string;
  resolutionSource?: string;
  resolutionDeadline?: string;
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookieSessionId = cookieStore.get("fv_user")?.value ?? null;
  let sessionId: string | null = cookieSessionId;
  let user = cookieSessionId ? await getUserBySessionSupabase(cookieSessionId) : null;

  if (!user) {
    const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;

    if (token) {
      try {
        user = await getUserByOauthAccessTokenSupabase(token);
        if (user) {
          sessionId = "oauth_gpt";
        }
      } catch (error: any) {
        const msg = typeof error?.message === "string" ? error.message : "unknown";
        if (msg.toLowerCase().includes("oauth_tokens")) {
          return NextResponse.json(
            { error: "OAuth ist noch nicht aktiviert. Bitte fuehre `supabase/oauth_gpt.sql` in Supabase aus." },
            { status: 503 }
          );
        }
        console.error("Draft OAuth lookup failed", error);
        return NextResponse.json(
          { error: "Bitte melde dich an, bevor du eine Frage vorschlägst." },
          { status: 401 }
        );
      }
    }
  }

  if (!user) {
    return NextResponse.json(
      { error: "Bitte melde dich an, bevor du eine Frage vorschlägst." },
      { status: 401 }
    );
  }

  let body: DraftInput;
  try {
    body = (await request.json()) as DraftInput;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const title = (body.title ?? "").trim();
  const category = (body.category ?? "").trim();
  const description = (body.description ?? "").trim() || undefined;
  const region = (body.region ?? "").trim() || undefined;
  const imageUrlRaw = (body.imageUrl ?? "").trim();
  const imageUrl =
    imageUrlRaw && imageUrlRaw.length > 4 && imageUrlRaw.length < 500 ? imageUrlRaw : undefined;
  const imageCredit = (body.imageCredit ?? "").trim() || undefined;
  const closesAtRaw = (body.closesAt ?? "").trim();
  const targetClosesAt =
    closesAtRaw && !Number.isNaN(Date.parse(closesAtRaw)) ? closesAtRaw : undefined;
  const resolutionCriteria = (body.resolutionCriteria ?? "").trim() || undefined;
  const resolutionSource = (body.resolutionSource ?? "").trim() || undefined;
  const resolutionDeadlineRaw = (body.resolutionDeadline ?? "").trim();
  const resolutionDeadline =
    resolutionDeadlineRaw && !Number.isNaN(Date.parse(resolutionDeadlineRaw)) ? resolutionDeadlineRaw : undefined;

  const answerMode: AnswerMode = body.answerMode === "options" ? "options" : "binary";
  const isResolvable = typeof body.isResolvable === "boolean" ? body.isResolvable : true;
  const resolutionCriteriaToSave = isResolvable ? resolutionCriteria : undefined;
  const resolutionSourceToSave = isResolvable ? resolutionSource : undefined;
  const resolutionDeadlineToSave = isResolvable ? resolutionDeadline : undefined;

  let options: string[] | undefined = undefined;
  if (answerMode === "options") {
    const raw = Array.isArray(body.options) ? body.options : [];
    const cleaned = raw
      .map((v) => String(v ?? "").trim())
      .filter((v) => v.length > 0)
      .slice(0, 6);

    if (cleaned.length < 2) {
      return NextResponse.json({ error: "Bitte gib mindestens 2 Antwortoptionen an." }, { status: 400 });
    }

    const seen = new Set<string>();
    for (const label of cleaned) {
      if (label.length > 80) {
        return NextResponse.json({ error: "Eine Option ist zu lang (max. 80 Zeichen)." }, { status: 400 });
      }
      const key = label.toLocaleLowerCase("de-DE");
      if (seen.has(key)) {
        return NextResponse.json({ error: "Antwortoptionen muessen eindeutig sein." }, { status: 400 });
      }
      seen.add(key);
    }

    options = cleaned;
  }

  if (!title) {
    return NextResponse.json({ error: "Bitte gib einen Titel ein." }, { status: 400 });
  }
  if (!category) {
    return NextResponse.json({ error: "Bitte wähle eine Kategorie." }, { status: 400 });
  }

  const visibility: PollVisibility =
    body.visibility === "link_only" || body.visibility === "public" ? body.visibility : "public";

  if (visibility === "public" && isResolvable) {
    if (!resolutionCriteria) {
      return NextResponse.json(
        { error: "Bitte beschreibe, wie die Frage aufgeloest wird (Aufloesungs-Regeln)." },
        { status: 400 }
      );
    }
    if (!resolutionSource) {
      return NextResponse.json(
        { error: "Bitte gib eine Quelle an (z. B. offizielle Seite/Institution oder Link)." },
        { status: 400 }
      );
    }
    if (!resolutionDeadline) {
      return NextResponse.json(
        { error: "Bitte setze eine Aufloesungs-Deadline (Datum/Uhrzeit)." },
        { status: 400 }
      );
    }
  }

  if (visibility === "link_only") {
    const anyResolution = Boolean(resolutionCriteria || resolutionSource || resolutionDeadline);
    if (anyResolution && !resolutionDeadline) {
      return NextResponse.json(
        { error: "Wenn du Aufloesungs-Regeln angibst, setze bitte auch eine Aufloesungs-Deadline (Datum/Uhrzeit)." },
        { status: 400 }
      );
    }
  }

  const timeLeftHours =
    typeof body.timeLeftHours === "number" && Number.isFinite(body.timeLeftHours) && body.timeLeftHours > 0
      ? body.timeLeftHours
      : 72;

  if (visibility === "link_only") {
    const question = await createLinkOnlyQuestionInSupabase({
      title,
      category,
      description,
      region,
      imageUrl,
      imageCredit,
      timeLeftHours,
      targetClosesAt,
      creatorId: user.id,
      answerMode,
      isResolvable,
      options,
      resolutionCriteria: resolutionCriteriaToSave,
      resolutionSource: resolutionSourceToSave,
      resolutionDeadline: resolutionDeadlineToSave,
    });
    await logAnalyticsEventServer({
      event: "create_private_poll",
      sessionId: sessionId ?? "unknown",
      userId: user.id,
      path: "/drafts/new",
      meta: { visibility: "link_only" },
    });

    const baseUrl = getBaseUrl();
    const shareId = question.shareId ?? null;
    const shareUrl = shareId ? `${baseUrl}/p/${encodeURIComponent(shareId)}` : null;

    return NextResponse.json(
      {
        kind: "question",
        id: question.id,
        shareId,
        shareUrl,
        question,
      },
      { status: 201 }
    );
  }

  const draft = await createDraftInSupabase({
    title,
    category,
    description,
    region,
    imageUrl,
    imageCredit,
    timeLeftHours,
    targetClosesAt,
    creatorId: user.id,
    visibility,
    answerMode,
    isResolvable,
    options,
    resolutionCriteria: resolutionCriteriaToSave,
    resolutionSource: resolutionSourceToSave,
    resolutionDeadline: resolutionDeadlineToSave,
  });
  await logAnalyticsEventServer({
    event: "create_draft",
    sessionId: sessionId ?? "unknown",
    userId: user.id,
    path: "/drafts/new",
    meta: { visibility },
  });
  return NextResponse.json(
    {
      kind: "draft",
      id: draft.id,
      draft,
    },
    { status: 201 }
  );
}
