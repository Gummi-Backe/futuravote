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

function normalizeImageUrl(raw?: string | null): string | undefined {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || trimmed.length <= 4 || trimmed.length >= 500) return undefined;
  return trimmed;
}

function addDaysIso(iso: string, days: number): string | null {
  const baseMs = Date.parse(iso);
  if (!Number.isFinite(baseMs)) return null;
  const nextMs = baseMs + days * 24 * 60 * 60 * 1000;
  return new Date(nextMs).toISOString();
}

function computeDefaultResolutionDeadlineIso({
  closesAtIso,
  timeLeftHours,
}: {
  closesAtIso?: string;
  timeLeftHours: number;
}): string {
  const baseIso = closesAtIso && !Number.isNaN(Date.parse(closesAtIso)) ? closesAtIso : new Date(Date.now() + timeLeftHours * 60 * 60 * 1000).toISOString();
  return addDaysIso(baseIso, 31) ?? new Date(Date.now() + (timeLeftHours * 60 * 60 + 31 * 24 * 60 * 60) * 1000).toISOString();
}

function isAllowedGptImageUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;

    const allowed = (process.env.FV_GPT_ALLOWED_IMAGE_HOSTS ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    if (allowed.length > 0) {
      return allowed.includes(url.hostname);
    }

    const defaultUrl = normalizeImageUrl(process.env.FV_GPT_DEFAULT_IMAGE_URL);
    if (defaultUrl) {
      const defaultHost = new URL(defaultUrl).hostname;
      if (url.hostname === defaultHost) return true;
    }

    // Fallback: erlaube Supabase Public Storage URLs (eigene Assets).
    if (url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/object/public/")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const cookieSessionId = cookieStore.get("fv_user")?.value ?? null;
  let sessionId: string | null = cookieSessionId;
  let user = cookieSessionId ? await getUserBySessionSupabase(cookieSessionId) : null;

  let isOauthGpt = false;
  if (!user) {
    const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;

    if (token) {
      try {
        user = await getUserByOauthAccessTokenSupabase(token);
        if (user) {
          sessionId = "oauth_gpt";
          isOauthGpt = true;
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
  let imageUrl = normalizeImageUrl(body.imageUrl);
  let imageCredit = (body.imageCredit ?? "").trim() || undefined;

  // Fuer GPT/OAuth: Externe Bild-URLs (z.B. Unsplash) werden nicht akzeptiert.
  // Wenn ein Bild gewuenscht ist, nutzen wir stattdessen das Standardbild aus FV_GPT_DEFAULT_IMAGE_URL.
  if (isOauthGpt && imageUrl && !isAllowedGptImageUrl(imageUrl)) {
    imageUrl = undefined;
    imageCredit = undefined;
  }

  // Fuer GPT/OAuth: wenn kein Bild uebergeben wurde, nutze ein Standardbild (z.B. eigenes KI-Logo in Supabase Storage).
  if (isOauthGpt && !imageUrl) {
    imageUrl = normalizeImageUrl(process.env.FV_GPT_DEFAULT_IMAGE_URL);
    if (!imageCredit) {
      imageCredit = (process.env.FV_GPT_DEFAULT_IMAGE_CREDIT ?? "").trim() || undefined;
    }
  }

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
  let resolutionDeadlineToSave = isResolvable ? resolutionDeadline : undefined;

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

  const timeLeftHours =
    typeof body.timeLeftHours === "number" && Number.isFinite(body.timeLeftHours) && body.timeLeftHours > 0
      ? body.timeLeftHours
      : 72;

  // Fail-safe: Bei oeffentlichen Prognosen soll es keine "missing resolutionDeadline" Fehler geben.
  // Wenn kein Datum uebergeben wurde, setzen wir automatisch eine Pruef-Deadline 31 Tage nach dem Enddatum.
  if (visibility === "public" && isResolvable && !resolutionDeadlineToSave) {
    resolutionDeadlineToSave = computeDefaultResolutionDeadlineIso({
      closesAtIso: targetClosesAt,
      timeLeftHours,
    });
  }

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
    if (!resolutionDeadlineToSave) {
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
