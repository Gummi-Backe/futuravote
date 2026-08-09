import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";

export const revalidate = 0;

type Body = {
  prompt?: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
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

function mapSizeForModel(_model: ImageModel, size: Body["size"]): string {
  const chosen = size === "1024x1536" || size === "1536x1024" ? size : "1024x1024";
  return chosen;
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

export async function POST(request: Request) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins duerfen diese Route nutzen." }, { status: 403 });
  }

  const imageRate = await consumeRateLimit({
    request,
    scope: "admin-image-generate",
    identifier: `user:${user.id}`,
    limit: 20,
    windowSeconds: 60 * 60,
  });
  if (!imageRate.allowed) {
    return rateLimitResponse(imageRate, "Bildlimit erreicht. Bitte später erneut versuchen.");
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ungueltiger Request-Body." }, { status: 400 });
  }

  const prompt = (body.prompt ?? "").trim();
  if (!prompt || prompt.length < 10) {
    return NextResponse.json({ error: "Prompt ist zu kurz." }, { status: 400 });
  }
  if (prompt.length > 1500) {
    return NextResponse.json({ error: "Prompt ist zu lang." }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY ist nicht gesetzt." }, { status: 500 });
  }

  let model: ImageModel | null = null;
  let json: OpenAiImagePayload | null = null;
  let lastOpenAiStatus = 0;

  for (const candidate of getImageModelCandidates()) {
    const size = mapSizeForModel(candidate, body.size);
    const res = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: candidate,
        prompt,
        size,
      }),
    });

    const payload = (await res.json().catch(() => null)) as OpenAiImagePayload | null;
    if (res.ok) {
      model = candidate;
      json = payload;
      break;
    }

    json = payload;
    lastOpenAiStatus = res.status;
    if (!shouldTryNextImageModel(payload, res.status)) {
      break;
    }
  }

  if (!model) {
    return NextResponse.json({ error: getOpenAiErrorMessage(json, lastOpenAiStatus) }, { status: 502 });
  }

  const first = json?.data?.[0];
  const b64 = first?.b64_json;
  if (typeof b64 === "string" && b64.trim()) {
    return NextResponse.json({ ok: true, mime: "image/png", b64 });
  }

  const url = first?.url;
  if (typeof url === "string" && url.trim()) {
    try {
      const imgRes = await fetch(url);
      if (!imgRes.ok) {
        return NextResponse.json({ error: "OpenAI Bild-URL konnte nicht geladen werden." }, { status: 502 });
      }
      const contentType = imgRes.headers.get("content-type") || "image/png";
      const arrayBuffer = await imgRes.arrayBuffer();
      const b64FromUrl = Buffer.from(arrayBuffer).toString("base64");
      return NextResponse.json({ ok: true, mime: contentType, b64: b64FromUrl });
    } catch {
      return NextResponse.json({ error: "OpenAI Bild-URL konnte nicht geladen werden." }, { status: 502 });
    }
  }

  return NextResponse.json({ error: "OpenAI hat kein Bild geliefert." }, { status: 502 });
}
