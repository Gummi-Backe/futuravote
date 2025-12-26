import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

type Body = {
  prompt?: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
};

type ImageModel = "dall-e-3" | "dall-e-2" | "gpt-image-1";

function getImageModel(): ImageModel {
  const raw = process.env.OPENAI_IMAGE_MODEL?.trim();
  if (raw === "dall-e-3" || raw === "dall-e-2" || raw === "gpt-image-1") return raw;
  // Default: DALL·E 3 works for most accounts without org verification (unlike gpt-image-1).
  return "dall-e-3";
}

function mapSizeForModel(model: ImageModel, size: Body["size"]): string {
  const chosen = size === "1024x1536" || size === "1536x1024" ? size : "1024x1024";

  // DALL·E sizes differ; map our UI options to the closest supported size.
  if (model === "dall-e-3") {
    if (chosen === "1536x1024") return "1792x1024";
    if (chosen === "1024x1536") return "1024x1792";
    return "1024x1024";
  }

  // gpt-image-1 and dall-e-2 accept 1024x1024; dall-e-2 also accepts 512/256, but we keep it simple.
  return chosen;
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
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

  const model = getImageModel();
  const size = mapSizeForModel(model, body.size);

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt,
      size,
      ...(model === "dall-e-3" ? { quality: "standard" } : null),
    }),
  });

  const json = (await res.json().catch(() => null)) as any;
  if (!res.ok) {
    const msg =
      typeof json?.error?.message === "string"
        ? json.error.message
        : typeof json?.message === "string"
          ? json.message
          : `OpenAI Fehler (${res.status})`;
    return NextResponse.json({ error: msg }, { status: 502 });
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
