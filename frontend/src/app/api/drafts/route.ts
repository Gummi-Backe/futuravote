import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getOauthAccessContextByTokenSupabase } from "@/app/data/dbSupabaseOauth";
import { createDraftInSupabase, createLinkOnlyQuestionInSupabase } from "@/app/data/dbSupabase";
import type { AnswerMode, PollVisibility } from "@/app/data/mock";
import { logAnalyticsEventServer } from "@/app/data/dbSupabaseAnalytics";
import { LONGTEXT_MARKER } from "@/app/lib/descriptionText";
import { buildDraftReviewUrl, buildPrivatePollUrl } from "@/app/lib/publicUrls";

export const revalidate = 0;

function hasOAuthScope(scope: string, required: string): boolean {
  const raw = String(scope ?? "").trim();
  if (!raw) return false;
  const parts = raw
    .split(/[,\s]+/g)
    .map((v) => v.trim())
    .filter(Boolean);
  return parts.includes(required);
}

type DraftInput = {
  title?: string;
  description?: string;
  longDescription?: string;
  allowWithoutLongDescription?: boolean;
  confirmSubmit?: boolean;
  category?: string;
  region?: string;
  imageUrl?: string;
  imageCredit?: string;
  timeLeftHours?: number;
  closesAt?: string;
  visibility?: PollVisibility;
  answerMode?: AnswerMode;
  isResolvable?: boolean;
  options?: string[] | string | null;
  resolutionCriteria?: string;
  resolutionSource?: string;
  resolutionSources?: string[];
  resolutionDeadline?: string;
};

type ErrorDetail = {
  field?: string;
  issue: string;
  value?: unknown;
};

const ALLOWED_DRAFT_KEYS = new Set<keyof DraftInput>([
  "title",
  "description",
  "longDescription",
  "allowWithoutLongDescription",
  "confirmSubmit",
  "category",
  "region",
  "imageUrl",
  "imageCredit",
  "timeLeftHours",
  "closesAt",
  "visibility",
  "answerMode",
  "isResolvable",
  "options",
  "resolutionCriteria",
  "resolutionSource",
  "resolutionSources",
  "resolutionDeadline",
]);

const DESCRIPTION_MAX_CHARS = 12_000;
const IMAGE_CREDIT_MAX_CHARS = 140;
const GPT_SHORT_DESCRIPTION_MIN_WORDS = 100;
const GPT_SHORT_DESCRIPTION_MAX_WORDS = 200;
const GPT_LONG_DESCRIPTION_MIN_WORDS = 600;
const GPT_LONG_DESCRIPTION_MAX_WORDS = 1000;

function errorResponse(
  status: number,
  error: string,
  errorCode: string,
  details?: ErrorDetail[] | Record<string, unknown>
) {
  return NextResponse.json(
    {
      error,
      errorCode,
      ...(details ? { details } : {}),
    },
    { status }
  );
}

function normalizeImageUrl(raw?: string | null): string | undefined {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed || trimmed.length <= 4 || trimmed.length >= 500) return undefined;
  return trimmed;
}

function normalizeResolutionSources(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of input) {
    if (typeof item !== "string") continue;
    const value = item.trim();
    if (!value) continue;
    if (value.length > 500) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= 8) break;
  }
  return out;
}

function normalizeOptionsInput(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((v) => String(v ?? "").trim()).filter((v) => v.length > 0);
  }
  if (typeof input === "string") {
    const raw = input.trim();
    if (!raw) return [];
    return raw
      .split(/\r?\n|[,;|]+/g)
      .map((v) => v.trim())
      .filter((v) => v.length > 0);
  }
  return [];
}

function countWords(raw: string): number {
  if (!raw) return 0;
  const cleaned = raw
    .replace(/\[size=(sm|lg|xl|xxl)\]/gi, " ")
    .replace(/\[\/size\]/gi, " ")
    .replace(/\*\*/g, " ")
    .replace(/__/g, " ")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/gi, "$1 ")
    .replace(/https?:\/\/\S+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return 0;
  return cleaned.split(" ").filter(Boolean).length;
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
  const baseIso =
    closesAtIso && !Number.isNaN(Date.parse(closesAtIso))
      ? closesAtIso
      : new Date(Date.now() + timeLeftHours * 60 * 60 * 1000).toISOString();
  return (
    addDaysIso(baseIso, 31) ??
    new Date(Date.now() + (timeLeftHours * 60 * 60 + 31 * 24 * 60 * 60) * 1000).toISOString()
  );
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

    if (url.hostname.endsWith(".supabase.co") && url.pathname.includes("/storage/v1/object/public/")) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

async function isReachableGptImageUrl(rawUrl: string): Promise<boolean> {
  try {
    const response = await fetch(rawUrl, {
      method: "GET",
      headers: { Range: "bytes=0-0" },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    await response.body?.cancel().catch(() => undefined);
    return response.ok && contentType.startsWith("image/");
  } catch (error) {
    console.error("GPT image availability check failed", error);
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
        const ctx = await getOauthAccessContextByTokenSupabase(token);
        if (ctx?.user) {
          if (!hasOAuthScope(ctx.scope, "drafts:write")) {
            return errorResponse(
              403,
              "OAuth Scope fehlt: drafts:write",
              "insufficient_scope",
              [{ field: "scope", issue: "required_scope_missing", value: "drafts:write" }]
            );
          }

          user = ctx.user;
          sessionId = "oauth_gpt";
          isOauthGpt = true;
        }
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "unknown";
        if (msg.toLowerCase().includes("oauth_tokens")) {
          return errorResponse(
            503,
            "OAuth ist noch nicht aktiviert. Bitte führe `supabase/oauth_gpt.sql` in Supabase aus.",
            "oauth_not_configured"
          );
        }
        console.error("Draft OAuth lookup failed", error);
        return errorResponse(401, "Bitte melde dich an, bevor du eine Frage vorschlägst.", "unauthorized");
      }
    }
  }

  if (!user) {
    return errorResponse(401, "Bitte melde dich an, bevor du eine Frage vorschlägst.", "unauthorized");
  }

  let body: DraftInput;
  try {
    body = (await request.json()) as DraftInput;
  } catch {
    return errorResponse(400, "Ungültiger Request-Body.", "invalid_json");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse(400, "Request-Body muss ein JSON-Objekt sein.", "invalid_payload_type");
  }

  const unsupportedKeys = Object.keys(body).filter(
    (key) => !ALLOWED_DRAFT_KEYS.has(key as keyof DraftInput)
  );
  if (unsupportedKeys.length > 0) {
    return errorResponse(400, "Unbekannte Felder im Payload.", "unsupported_fields", {
      unsupportedFields: unsupportedKeys,
    });
  }

  const visibility: PollVisibility =
    body.visibility === "link_only" || body.visibility === "public" ? body.visibility : "public";
  const isPrivatePoll = visibility === "link_only";

  if (body.visibility && body.visibility !== "public" && body.visibility !== "link_only") {
    return errorResponse(
      400,
      "Ungültige visibility. Erlaubt sind nur 'public' oder 'link_only'.",
      "invalid_visibility",
      [{ field: "visibility", issue: "must_be_public_or_link_only", value: body.visibility }]
    );
  }

  const title = (body.title ?? "").trim();
  const categoryRaw = (body.category ?? "").trim();
  const category = isPrivatePoll ? categoryRaw || "Privat" : categoryRaw;
  const rawDescription = (body.description ?? "").trim();
  let shortDescription = rawDescription;
  let parsedLongDescription = "";
  const markerMatch = rawDescription.match(/\n\s*\[\[\s*LANGTEXT\s*\]\]\s*\n/i);
  if (markerMatch && typeof markerMatch.index === "number") {
    shortDescription = rawDescription.slice(0, markerMatch.index).trim();
    parsedLongDescription = rawDescription.slice(markerMatch.index + markerMatch[0].length).trim();
  }
  const bodyLongDescription = (body.longDescription ?? "").trim();
  const effectiveLongDescription = (bodyLongDescription || parsedLongDescription).trim();
  const mergedDescription =
    shortDescription && effectiveLongDescription
      ? `${shortDescription}\n\n${LONGTEXT_MARKER}\n\n${effectiveLongDescription}`.trim()
      : shortDescription || undefined;
  const region = isPrivatePoll ? undefined : (body.region ?? "").trim() || undefined;
  const warnings: string[] = [];

  if (title.length < 12) {
    return errorResponse(400, "Titel ist zu kurz (mindestens 12 Zeichen).", "title_too_short", [
      { field: "title", issue: "min_length_12" },
    ]);
  }
  if (title.length > 220) {
    return errorResponse(400, "Titel ist zu lang (maximal 220 Zeichen).", "title_too_long", [
      { field: "title", issue: "max_length_220" },
    ]);
  }

  if (!isPrivatePoll && !category) {
    return errorResponse(400, "Bitte wähle eine Kategorie.", "category_required", [
      { field: "category", issue: "required_for_public" },
    ]);
  }
  if (category.length > 60) {
    return errorResponse(400, "Kategorie ist zu lang (maximal 60 Zeichen).", "category_too_long", [
      { field: "category", issue: "max_length_60" },
    ]);
  }
  if (effectiveLongDescription && !shortDescription) {
    return errorResponse(
      400,
      "Wenn longDescription gesetzt ist, muss auch eine kurze description vorhanden sein.",
      "description_required_with_long_description",
      [{ field: "description", issue: "required_with_longDescription" }]
    );
  }
  if (mergedDescription && mergedDescription.length > DESCRIPTION_MAX_CHARS) {
    return errorResponse(
      400,
      `Beschreibung ist zu lang (maximal ${DESCRIPTION_MAX_CHARS} Zeichen).`,
      "description_too_long",
      [{ field: "description", issue: `max_length_${DESCRIPTION_MAX_CHARS}` }]
    );
  }
  if (region && region.length > 80) {
    return errorResponse(400, "Region ist zu lang (maximal 80 Zeichen).", "region_too_long", [
      { field: "region", issue: "max_length_80" },
    ]);
  }

  const imageUrl = normalizeImageUrl(body.imageUrl);
  const imageCredit = (body.imageCredit ?? "").trim() || undefined;
  const shortDescriptionWordCount = countWords(shortDescription);
  const longDescriptionWordCount = countWords(effectiveLongDescription);
  const allowWithoutLongDescription = body.allowWithoutLongDescription === true;
  const confirmSubmit = body.confirmSubmit === true;

  if (typeof body.confirmSubmit !== "undefined" && typeof body.confirmSubmit !== "boolean") {
    return errorResponse(400, "confirmSubmit muss true oder false sein.", "invalid_confirm_submit", [
      { field: "confirmSubmit", issue: "must_be_boolean", value: body.confirmSubmit },
    ]);
  }
  if (typeof body.allowWithoutLongDescription !== "undefined" && typeof body.allowWithoutLongDescription !== "boolean") {
    return errorResponse(
      400,
      "allowWithoutLongDescription muss true oder false sein.",
      "invalid_allow_without_long_description",
      [{ field: "allowWithoutLongDescription", issue: "must_be_boolean", value: body.allowWithoutLongDescription }]
    );
  }

  if (imageUrl) {
    try {
      const parsed = new URL(imageUrl);
      if (parsed.protocol !== "https:") {
        return errorResponse(400, "imageUrl muss mit https:// beginnen.", "invalid_image_url", [
          { field: "imageUrl", issue: "https_required" },
        ]);
      }
    } catch {
      return errorResponse(400, "imageUrl ist keine gültige URL.", "invalid_image_url", [
        { field: "imageUrl", issue: "invalid_url_format" },
      ]);
    }
  }

  if (isOauthGpt && imageUrl && !isAllowedGptImageUrl(imageUrl)) {
    return errorResponse(
      400,
      "imageUrl-Host ist für GPT-OAuth nicht freigegeben. Bitte nutze zuerst /api/gpt/generate-image.",
      "invalid_image_host_for_gpt",
      [{ field: "imageUrl", issue: "host_not_allowed_for_gpt" }]
    );
  }

  if (isOauthGpt && imageUrl && !(await isReachableGptImageUrl(imageUrl))) {
    return errorResponse(
      422,
      "Das erzeugte Bild ist nicht mehr erreichbar. Bitte erzeuge ein neues Bild und zeige die aktualisierte Vorschau erneut.",
      "image_unavailable_for_gpt",
      [{ field: "imageUrl", issue: "generated_image_not_reachable" }]
    );
  }

  if (isOauthGpt && !imageUrl) {
    return errorResponse(
      400,
      "Für GPT-OAuth ist imageUrl Pflicht. Bitte zuerst /api/gpt/generate-image aufrufen.",
      "image_required_for_gpt",
      [{ field: "imageUrl", issue: "required_for_gpt_oauth" }]
    );
  }
  if (imageCredit && imageCredit.length > IMAGE_CREDIT_MAX_CHARS) {
    return errorResponse(
      400,
      `imageCredit ist zu lang (maximal ${IMAGE_CREDIT_MAX_CHARS} Zeichen).`,
      "image_credit_too_long",
      [{ field: "imageCredit", issue: `max_length_${IMAGE_CREDIT_MAX_CHARS}` }]
    );
  }
  if (isOauthGpt && !imageCredit) {
    return errorResponse(
      400,
      "Für GPT-OAuth ist imageCredit Pflicht.",
      "image_credit_required_for_gpt",
      [{ field: "imageCredit", issue: "required_for_gpt_oauth" }]
    );
  }
  if (isOauthGpt && !confirmSubmit) {
    return errorResponse(
      400,
      "Für GPT-OAuth ist confirmSubmit=true Pflicht. Zeige zuerst die Vorschau und frage nach Freigabe.",
      "explicit_confirmation_required",
      [{ field: "confirmSubmit", issue: "must_be_true_for_gpt_oauth" }]
    );
  }
  const closesAtRaw = (body.closesAt ?? "").trim();
  const targetClosesAt = closesAtRaw && !Number.isNaN(Date.parse(closesAtRaw)) ? closesAtRaw : undefined;
  if (closesAtRaw && !targetClosesAt) {
    return errorResponse(400, "closesAt muss ein gültiges ISO-Datum sein.", "invalid_closes_at", [
      { field: "closesAt", issue: "invalid_iso_datetime", value: closesAtRaw },
    ]);
  }
  if (isPrivatePoll && !targetClosesAt) {
    return errorResponse(
      400,
      "Für private Link-Umfragen ist closesAt als zukünftiges ISO-Datum Pflicht.",
      "closes_at_required_for_link_only",
      [{ field: "closesAt", issue: "required_for_link_only" }]
    );
  }
  if (targetClosesAt && Date.parse(targetClosesAt) <= Date.now()) {
    return errorResponse(400, "closesAt muss in der Zukunft liegen.", "closes_at_must_be_future", [
      { field: "closesAt", issue: "must_be_future", value: closesAtRaw },
    ]);
  }

  const resolutionCriteria = (body.resolutionCriteria ?? "").trim() || undefined;
  const resolutionSource = (body.resolutionSource ?? "").trim() || undefined;
  const resolutionDeadlineRaw = (body.resolutionDeadline ?? "").trim();
  const resolutionDeadline =
    resolutionDeadlineRaw && !Number.isNaN(Date.parse(resolutionDeadlineRaw)) ? resolutionDeadlineRaw : undefined;
  if (resolutionDeadlineRaw && !resolutionDeadline) {
    return errorResponse(
      400,
      "resolutionDeadline muss ein gültiges ISO-Datum sein.",
      "invalid_resolution_deadline",
      [{ field: "resolutionDeadline", issue: "invalid_iso_datetime", value: resolutionDeadlineRaw }]
    );
  }

  if (body.answerMode && body.answerMode !== "binary" && body.answerMode !== "options") {
    return errorResponse(
      400,
      "Ungültiger answerMode. Erlaubt sind nur 'binary' oder 'options'.",
      "invalid_answer_mode",
      [{ field: "answerMode", issue: "must_be_binary_or_options", value: body.answerMode }]
    );
  }
  const answerMode: AnswerMode = body.answerMode === "options" ? "options" : "binary";

  if (typeof body.isResolvable !== "undefined" && typeof body.isResolvable !== "boolean") {
    return errorResponse(400, "isResolvable muss true oder false sein.", "invalid_is_resolvable", [
      { field: "isResolvable", issue: "must_be_boolean", value: body.isResolvable },
    ]);
  }
  if (typeof body.resolutionSources !== "undefined" && !Array.isArray(body.resolutionSources)) {
    return errorResponse(400, "resolutionSources muss ein Array sein.", "invalid_resolution_sources", [
      { field: "resolutionSources", issue: "must_be_array", value: body.resolutionSources },
    ]);
  }
  const isResolvableRaw = typeof body.isResolvable === "boolean" ? body.isResolvable : true;
  const isResolvable = isPrivatePoll ? false : isResolvableRaw;
  if (isPrivatePoll && isResolvableRaw) {
    return errorResponse(
      400,
      "Bei visibility='link_only' sind nur Meinungs-Umfragen erlaubt (isResolvable=false).",
      "invalid_private_resolvable_combo",
      [{ field: "isResolvable", issue: "must_be_false_for_link_only", value: body.isResolvable }]
    );
  }

  const resolutionCriteriaToSave = isResolvable ? resolutionCriteria : undefined;
  const resolutionSourcesRaw = normalizeResolutionSources(body.resolutionSources);
  const resolutionSourcesMerged = (() => {
    const merged = [...resolutionSourcesRaw, resolutionSource ?? ""];
    const out: string[] = [];
    const seen = new Set<string>();
    for (const item of merged) {
      const value = String(item ?? "").trim();
      if (!value) continue;
      const key = value.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(value);
      if (out.length >= 8) break;
    }
    return out;
  })();
  const effectiveResolutionSource = resolutionSourcesMerged[0];
  const resolutionSourceToSave = isResolvable ? effectiveResolutionSource : undefined;
  const resolutionSourcesToSave = isResolvable ? resolutionSourcesMerged : undefined;
  let resolutionDeadlineToSave = isResolvable ? resolutionDeadline : undefined;

  let options: string[] | undefined = undefined;
  const normalizedOptions = normalizeOptionsInput(body.options);
  if (answerMode === "options") {
    const cleaned = normalizedOptions.slice(0, 6);

    if (cleaned.length < 2) {
      return errorResponse(400, "Bitte gib mindestens 2 Antwortoptionen an.", "options_min_2", [
        { field: "options", issue: "min_items_2" },
      ]);
    }

    const seen = new Set<string>();
    for (const label of cleaned) {
      if (label.length > 80) {
        return errorResponse(400, "Eine Option ist zu lang (max. 80 Zeichen).", "option_too_long", [
          { field: "options", issue: "option_max_length_80" },
        ]);
      }
      const key = label.toLocaleLowerCase("de-DE");
      if (seen.has(key)) {
        return errorResponse(400, "Antwortoptionen müssen eindeutig sein.", "options_not_unique", [
          { field: "options", issue: "duplicate_values" },
        ]);
      }
      seen.add(key);
    }

    options = cleaned;
  } else if (normalizedOptions.length > 0) {
    warnings.push("options wurde ignoriert, weil answerMode='binary' ist.");
  }

  // Review-Zeitraum ist fix: 72 Stunden (keine User-Auswahl).
  const timeLeftHours = 72;
  if (typeof body.timeLeftHours === "number" && body.timeLeftHours !== timeLeftHours) {
    warnings.push("timeLeftHours wird ignoriert. Der Review-Zeitraum ist fest auf 72 Stunden gesetzt.");
  }

  if (visibility === "public" && isResolvable && !resolutionDeadlineToSave) {
    resolutionDeadlineToSave = computeDefaultResolutionDeadlineIso({
      closesAtIso: targetClosesAt,
      timeLeftHours,
    });
  }

  if (visibility === "public" && isResolvable) {
    if (!resolutionCriteria) {
      return errorResponse(
        400,
        "Bitte beschreibe, wie die Frage aufgelöst wird (Auflösungs-Regeln).",
        "resolution_criteria_required",
        [{ field: "resolutionCriteria", issue: "required_for_public_resolvable" }]
      );
    }
    if (!effectiveResolutionSource) {
      return errorResponse(
        400,
        "Bitte gib eine Quelle an (z. B. offizielle Seite/Institution oder Link).",
        "resolution_source_required",
        [{ field: "resolutionSource/resolutionSources", issue: "required_for_public_resolvable" }]
      );
    }
    if (!resolutionDeadlineToSave) {
      return errorResponse(
        400,
        "Bitte setze eine Auflösungs-Deadline (Datum/Uhrzeit).",
        "resolution_deadline_required",
        [{ field: "resolutionDeadline", issue: "required_for_public_resolvable" }]
      );
    }
  } else if (resolutionCriteria || effectiveResolutionSource || resolutionDeadline || resolutionSourcesRaw.length > 0) {
    return errorResponse(
      400,
      "resolutionCriteria, resolutionSource, resolutionSources und resolutionDeadline sind nur bei öffentlichen Prognosen erlaubt.",
      "resolution_fields_not_allowed",
      [
        {
          field: "resolutionCriteria/resolutionSource/resolutionSources/resolutionDeadline",
          issue: "only_allowed_for_public_resolvable",
        },
      ]
    );
  }

  if (isOauthGpt && visibility === "public") {
    if (!shortDescription) {
      return errorResponse(
        400,
        "Für GPT-OAuth und öffentliche Fragen ist description Pflicht.",
        "description_required_for_gpt_public",
        [{ field: "description", issue: "required_for_gpt_public" }]
      );
    }
    if (
      shortDescriptionWordCount < GPT_SHORT_DESCRIPTION_MIN_WORDS ||
      shortDescriptionWordCount > GPT_SHORT_DESCRIPTION_MAX_WORDS
    ) {
      return errorResponse(
        400,
        `description muss fuer GPT-OAuth bei öffentlichen Fragen ${GPT_SHORT_DESCRIPTION_MIN_WORDS}-${GPT_SHORT_DESCRIPTION_MAX_WORDS} Wörter haben (aktuell ${shortDescriptionWordCount}).`,
        "description_word_count_out_of_range",
        [
          {
            field: "description",
            issue: `word_count_${GPT_SHORT_DESCRIPTION_MIN_WORDS}_${GPT_SHORT_DESCRIPTION_MAX_WORDS}`,
            value: shortDescriptionWordCount,
          },
        ]
      );
    }
  }

  if (isOauthGpt && visibility === "public" && isResolvable) {
    if (!effectiveLongDescription && !allowWithoutLongDescription) {
      return errorResponse(
        400,
        "Für öffentliche Prognosen via GPT-OAuth ist longDescription Pflicht (oder allowWithoutLongDescription=true).",
        "long_description_required_for_gpt_public_prediction",
        [{ field: "longDescription", issue: "required_unless_explicitly_disabled" }]
      );
    }
    if (effectiveLongDescription) {
      if (
        longDescriptionWordCount < GPT_LONG_DESCRIPTION_MIN_WORDS ||
        longDescriptionWordCount > GPT_LONG_DESCRIPTION_MAX_WORDS
      ) {
        return errorResponse(
          400,
          `longDescription muss fuer GPT-OAuth bei öffentlichen Prognosen ${GPT_LONG_DESCRIPTION_MIN_WORDS}-${GPT_LONG_DESCRIPTION_MAX_WORDS} Wörter haben (aktuell ${longDescriptionWordCount}).`,
          "long_description_word_count_out_of_range",
          [
            {
              field: "longDescription",
              issue: `word_count_${GPT_LONG_DESCRIPTION_MIN_WORDS}_${GPT_LONG_DESCRIPTION_MAX_WORDS}`,
              value: longDescriptionWordCount,
            },
          ]
        );
      }
    }
  }

  if (visibility === "link_only") {
    const question = await createLinkOnlyQuestionInSupabase({
      title,
      category,
      description: mergedDescription,
      region: undefined,
      imageUrl,
      imageCredit,
      timeLeftHours,
      targetClosesAt,
      creatorId: user.id,
      answerMode,
      isResolvable: false,
      options,
      resolutionCriteria: undefined,
      resolutionSource: undefined,
      resolutionSources: undefined,
      resolutionDeadline: undefined,
    });

    await logAnalyticsEventServer({
      event: "create_private_poll",
      sessionId: sessionId ?? "unknown",
      userId: user.id,
      path: "/drafts/new",
      meta: { visibility: "link_only" },
    });

    const shareId = question.shareId ?? null;
    if (!shareId) {
      return errorResponse(500, "Private Umfrage wurde ohne Share-ID erstellt.", "share_id_missing");
    }
    const shareUrl = buildPrivatePollUrl(shareId);
    const result = {
      kind: "question",
      submissionType: "private_link",
      id: question.id,
      shareId,
      url: shareUrl,
      shareUrl,
      message: "Private Link-Umfrage wurde erstellt. Verwende ausschließlich die zurückgegebene shareUrl.",
      ...(warnings.length ? { warnings } : {}),
    };

    return NextResponse.json(
      isOauthGpt ? result : { ...result, question },
      { status: 201 }
    );
  }

  const draft = await createDraftInSupabase({
    title,
    category,
    description: mergedDescription,
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
    resolutionSources: resolutionSourcesToSave,
    resolutionDeadline: resolutionDeadlineToSave,
  });

  await logAnalyticsEventServer({
    event: "create_draft",
    sessionId: sessionId ?? "unknown",
    userId: user.id,
    path: "/drafts/new",
    meta: { visibility },
  });

  const reviewUrl = buildDraftReviewUrl(draft.id);
  const result = {
    kind: "draft",
    submissionType: "public_review",
    id: draft.id,
    url: reviewUrl,
    reviewUrl,
    message:
      "Öffentlicher Draft wurde zur Community-Prüfung eingereicht. Verwende ausschließlich die zurückgegebene reviewUrl.",
    ...(warnings.length ? { warnings } : {}),
  };

  return NextResponse.json(isOauthGpt ? result : { ...result, draft }, { status: 201 });
}
