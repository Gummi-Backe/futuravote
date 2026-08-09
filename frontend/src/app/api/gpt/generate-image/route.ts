import { randomUUID } from "crypto";
import sharp from "sharp";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getOauthAccessContextByTokenSupabase } from "@/app/data/dbSupabaseOauth";
import { getSupabaseServerClient } from "@/app/lib/supabaseServerClient";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";

export const revalidate = 0;

type Body = {
  prompt?: string;
  size?: "1024x1024";
};

type ImageModel = "gpt-image-2" | "gpt-image-1.5" | "gpt-image-1" | "gpt-image-1-mini";

type OpenAiImagePayload = {
  error?: {
    code?: unknown;
    message?: unknown;
    type?: unknown;
  };
  message?: unknown;
  data?: Array<{
    b64_json?: unknown;
    url?: unknown;
  }>;
};

const DEFAULT_IMAGE_MODEL: ImageModel = "gpt-image-2";
const IMAGE_MODEL_ORDER: readonly ImageModel[] = [
  DEFAULT_IMAGE_MODEL,
  "gpt-image-1.5",
  "gpt-image-1",
  "gpt-image-1-mini",
];

const IMAGE_BUCKET = process.env.SUPABASE_IMAGE_BUCKET || "question-images";
const MAX_PROMPT_LENGTH = 1500;
const TARGET_WIDTH = 512;
const TARGET_HEIGHT = 512;

function hasOAuthScope(scope: string, required: string): boolean {
  const raw = String(scope ?? "").trim();
  if (!raw) return false;
  const parts = raw
    .split(/[,\s]+/g)
    .map((value) => value.trim())
    .filter(Boolean);
  return parts.includes(required);
}

function isImageModel(raw: string | undefined): raw is ImageModel {
  return (
    raw === "gpt-image-2" ||
    raw === "gpt-image-1.5" ||
    raw === "gpt-image-1" ||
    raw === "gpt-image-1-mini"
  );
}

function getImageModelCandidates(): ImageModel[] {
  const configured = process.env.OPENAI_IMAGE_MODEL?.trim();
  const candidates: ImageModel[] = [DEFAULT_IMAGE_MODEL];

  if (isImageModel(configured) && configured !== DEFAULT_IMAGE_MODEL) {
    candidates.push(configured);
  }

  for (const model of IMAGE_MODEL_ORDER) {
    if (!candidates.includes(model)) candidates.push(model);
  }

  return candidates;
}

function getOpenAiErrorMessage(payload: OpenAiImagePayload | null, status: number): string {
  if (typeof payload?.error?.message === "string") return payload.error.message;
  if (typeof payload?.message === "string") return payload.message;
  return `OpenAI Fehler (${status})`;
}

function shouldTryNextImageModel(payload: OpenAiImagePayload | null, status: number): boolean {
  const code = String(payload?.error?.code ?? payload?.error?.type ?? "").toLowerCase();
  const message = getOpenAiErrorMessage(payload, status).toLowerCase();
  return (
    status === 404 ||
    code.includes("model") ||
    message.includes("does not exist") ||
    message.includes("do not have access") ||
    message.includes("not have access") ||
    message.includes("must be verified")
  );
}

function mapSizeForModel(model: ImageModel, size: Body["size"]): string {
  const selected = size === "1024x1024" ? "1024x1024" : "1024x1024";
  return selected;
}

function buildSafePrompt(rawPrompt: string): string {
  return [
    "Erstelle ein fotorealistisches, journalistisches, quadratisches Bild als Thumbnail fuer eine Umfragekarte.",
    "Keine Logos, keine Wasserzeichen, keine Marken, keine bekannten Personen, keine Politiker.",
    "Neutrale Stimmung, klarer Fokus, ohne manipulative Symbolik.",
    "Kein lesbarer Text im Bild.",
    "",
    "Thema:",
    rawPrompt,
  ].join("\n");
}

export async function POST(request: Request) {
  const invalidSource = mutationRequestGuard(request, { allowBearer: true });
  if (invalidSource) return invalidSource;

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
  let authenticatedUserId: string | null = null;

  if (bearerToken) {
    try {
      const ctx = await getOauthAccessContextByTokenSupabase(bearerToken);
      if (!ctx?.user) {
        return NextResponse.json(
          { error: "ungueltiger token", errorCode: "invalid_token" },
          { status: 401, headers: { "Cache-Control": "no-store" } }
        );
      }
      if (!hasOAuthScope(ctx.scope, "drafts:write")) {
        return NextResponse.json(
          { error: "OAuth Scope fehlt: drafts:write", errorCode: "insufficient_scope" },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
      authenticatedUserId = ctx.user.id;
    } catch {
      return NextResponse.json(
        { error: "ungueltiger token", errorCode: "invalid_token" },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
  } else {
    const cookieStore = await cookies();
    const sessionId = cookieStore.get("fv_user")?.value;
    const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;
    authenticatedUserId = user?.id ?? null;
  }

  if (!authenticatedUserId) {
    return NextResponse.json(
      { error: "Bitte anmelden oder OAuth verbinden.", errorCode: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const [hourlyImageRate, dailyImageRate] = await Promise.all([
    consumeRateLimit({
      request,
      scope: "gpt-image-hourly",
      identifier: `user:${authenticatedUserId}`,
      limit: 10,
      windowSeconds: 60 * 60,
    }),
    consumeRateLimit({
      request,
      scope: "gpt-image-daily",
      identifier: `user:${authenticatedUserId}`,
      limit: 30,
      windowSeconds: 24 * 60 * 60,
    }),
  ]);
  const blockedImageRate = !hourlyImageRate.allowed ? hourlyImageRate : !dailyImageRate.allowed ? dailyImageRate : null;
  if (blockedImageRate) {
    return rateLimitResponse(blockedImageRate, "Bildlimit erreicht. Bitte später erneut versuchen.");
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "Ungueltiger Request-Body.", errorCode: "invalid_json" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const prompt = String(body.prompt ?? "").trim();
  if (!prompt || prompt.length < 10) {
    return NextResponse.json(
      { error: "Prompt ist zu kurz.", errorCode: "prompt_too_short" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (prompt.length > MAX_PROMPT_LENGTH) {
    return NextResponse.json(
      { error: "Prompt ist zu lang.", errorCode: "prompt_too_long" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  if (typeof body.size !== "undefined" && body.size !== "1024x1024") {
    return NextResponse.json(
      { error: "Nur size=1024x1024 ist erlaubt.", errorCode: "invalid_size" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY ist nicht gesetzt.", errorCode: "openai_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const safePrompt = buildSafePrompt(prompt);
  let model: ImageModel | null = null;
  let openAiJson: OpenAiImagePayload | null = null;
  let lastOpenAiStatus = 0;

  for (const candidate of getImageModelCandidates()) {
    const size = mapSizeForModel(candidate, body.size);
    const openAiResponse = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: candidate,
        prompt: safePrompt,
        size,
      }),
    });

    const json = (await openAiResponse.json().catch(() => null)) as OpenAiImagePayload | null;
    if (openAiResponse.ok) {
      model = candidate;
      openAiJson = json;
      break;
    }

    openAiJson = json;
    lastOpenAiStatus = openAiResponse.status;
    if (!shouldTryNextImageModel(json, openAiResponse.status)) {
      break;
    }
  }

  if (!model) {
    const message = getOpenAiErrorMessage(openAiJson, lastOpenAiStatus);
    return NextResponse.json(
      { error: message, errorCode: "openai_generation_failed" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  const firstImage = openAiJson?.data?.[0];
  let sourceBuffer: Buffer | null = null;

  if (typeof firstImage?.b64_json === "string" && firstImage.b64_json.trim()) {
    sourceBuffer = Buffer.from(firstImage.b64_json, "base64");
  } else if (typeof firstImage?.url === "string" && firstImage.url.trim()) {
    try {
      const imageFetch = await fetch(firstImage.url);
      if (!imageFetch.ok) {
        return NextResponse.json(
          { error: "OpenAI Bild-URL konnte nicht geladen werden.", errorCode: "openai_image_fetch_failed" },
          { status: 502, headers: { "Cache-Control": "no-store" } }
        );
      }
      const arrayBuffer = await imageFetch.arrayBuffer();
      sourceBuffer = Buffer.from(arrayBuffer);
    } catch {
      return NextResponse.json(
        { error: "OpenAI Bild-URL konnte nicht geladen werden.", errorCode: "openai_image_fetch_failed" },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }
  }

  if (!sourceBuffer) {
    return NextResponse.json(
      { error: "OpenAI hat kein Bild geliefert.", errorCode: "openai_no_image" },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }

  let resizedJpeg: Buffer;
  try {
    resizedJpeg = await sharp(sourceBuffer)
      .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover", position: "centre" })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { error: "Bild konnte nicht verarbeitet werden.", errorCode: "image_processing_failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const supabase = getSupabaseServerClient();
  const filename = `gpt-${randomUUID()}.jpg`;
  const pathInBucket = `questions/${filename}`;
  const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(pathInBucket, resizedJpeg, {
    contentType: "image/jpeg",
    upsert: false,
  });

  if (uploadError) {
    return NextResponse.json(
      { error: "Bild konnte nicht gespeichert werden.", errorCode: "storage_upload_failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from(IMAGE_BUCKET).getPublicUrl(pathInBucket);

  return NextResponse.json(
    {
      imageUrl: publicUrl,
      imageCredit: "KI-Bild (OpenAI)",
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      model,
    },
    { status: 201, headers: { "Cache-Control": "no-store" } }
  );
}
