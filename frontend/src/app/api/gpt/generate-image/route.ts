import { randomUUID } from "crypto";
import sharp from "sharp";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getOauthAccessContextByTokenSupabase } from "@/app/data/dbSupabaseOauth";
import { getSupabaseServerClient } from "@/app/lib/supabaseServerClient";
import { guardGptRateLimit } from "../_lib";

export const revalidate = 0;

type Body = {
  prompt?: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
};

type ImageModel = "dall-e-3" | "gpt-image-1.5";

const IMAGE_BUCKET = process.env.SUPABASE_IMAGE_BUCKET || "question-images";
const MAX_PROMPT_LENGTH = 1500;
const TARGET_WIDTH = 250;
const TARGET_HEIGHT = 150;

function hasOAuthScope(scope: string, required: string): boolean {
  const raw = String(scope ?? "").trim();
  if (!raw) return false;
  const parts = raw
    .split(/[,\s]+/g)
    .map((value) => value.trim())
    .filter(Boolean);
  return parts.includes(required);
}

function getImageModel(): ImageModel {
  const raw = process.env.OPENAI_IMAGE_MODEL?.trim();
  if (raw === "dall-e-3" || raw === "gpt-image-1.5") return raw;
  return "dall-e-3";
}

function mapSizeForModel(model: ImageModel, size: Body["size"]): string {
  const selected = size === "1024x1536" || size === "1536x1024" ? size : "1024x1024";
  if (model === "dall-e-3") {
    if (selected === "1536x1024") return "1792x1024";
    if (selected === "1024x1536") return "1024x1792";
    return "1024x1024";
  }
  return selected;
}

function buildSafePrompt(rawPrompt: string): string {
  return [
    "Erstelle ein fotorealistisches, journalistisches Bild als Thumbnail fuer eine Umfragekarte.",
    "Keine Logos, keine Wasserzeichen, keine Marken, keine bekannten Personen, keine Politiker.",
    "Neutrale Stimmung, klarer Fokus, ohne manipulative Symbolik.",
    "Kein lesbarer Text im Bild.",
    "",
    "Thema:",
    rawPrompt,
  ].join("\n");
}

export async function POST(request: Request) {
  const limited = guardGptRateLimit(request);
  if (limited) return limited;

  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization") ?? "";
  const bearerToken = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : null;
  let authenticated = false;

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
      authenticated = true;
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
    authenticated = Boolean(user);
  }

  if (!authenticated) {
    return NextResponse.json(
      { error: "Bitte anmelden oder OAuth verbinden.", errorCode: "unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
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

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY ist nicht gesetzt.", errorCode: "openai_not_configured" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  const model = getImageModel();
  const size = mapSizeForModel(model, body.size);
  const safePrompt = buildSafePrompt(prompt);

  const openAiResponse = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: safePrompt,
      size,
      ...(model === "dall-e-3" ? { quality: "standard" } : null),
    }),
  });

  const openAiJson = (await openAiResponse.json().catch(() => null)) as any;
  if (!openAiResponse.ok) {
    const message =
      typeof openAiJson?.error?.message === "string"
        ? openAiJson.error.message
        : typeof openAiJson?.message === "string"
          ? openAiJson.message
          : `OpenAI Fehler (${openAiResponse.status})`;
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
      .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "inside", withoutEnlargement: true })
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
