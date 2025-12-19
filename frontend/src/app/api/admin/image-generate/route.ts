import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

type Body = {
  prompt?: string;
  size?: "1024x1024" | "1024x1536" | "1536x1024";
};

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins duerfen diese Route nutzen." }, { status: 403 });
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

  const size: Body["size"] = body.size === "1024x1536" || body.size === "1536x1024" ? body.size : "1024x1024";

  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size,
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
