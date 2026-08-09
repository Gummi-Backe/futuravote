import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getQuestionByIdFromSupabase } from "@/app/data/dbSupabase";
import { splitDescriptionText } from "@/app/lib/descriptionText";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";

export const revalidate = 0;

type Body = {
  questionId?: string;
  context?: string;
};

type Suggestion = {
  body: string;
  sourceUrl: string | null;
  sourceUrls: string[];
  sources: string[];
};

function safeJsonFromText(text: string): unknown {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
    .replace(/[“”]/g, "\"");

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return null;
    }
  }
}

function normalizeSource(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const value = input.trim();
  if (!value) return null;
  if (value.length > 500) return null;
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

function normalizeSuggestion(raw: unknown): Suggestion | null {
  const data = (typeof raw === "object" && raw !== null ? raw : {}) as {
    body?: unknown;
    sourceUrl?: unknown;
    sourceUrls?: unknown;
    sources?: unknown;
  };

  const body = typeof data.body === "string" ? data.body.trim() : "";
  if (body.length < 40 || body.length > 8000) return null;

  const sourceUrl = normalizeSource(data.sourceUrl);
  const sourceUrlsRaw: unknown[] = Array.isArray(data.sourceUrls) ? data.sourceUrls : [];
  const sourceUrls = sourceUrlsRaw.map((v) => normalizeSource(v)).filter(Boolean) as string[];
  const sourcesRaw: unknown[] = Array.isArray(data.sources) ? data.sources : [];
  const sources = sourcesRaw.map((v) => normalizeSource(v)).filter(Boolean) as string[];
  const merged = [...sourceUrls, ...sources, sourceUrl].filter(Boolean) as string[];
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const item of merged) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= 8) break;
  }

  return {
    body: body.slice(0, 8000),
    sourceUrl: deduped[0] ?? null,
    sourceUrls: deduped,
    sources: deduped,
  };
}

function buildPrompt(input: {
  title: string;
  category: string;
  region: string | null;
  shortDescription: string;
  longDescription: string | null;
  context: string;
  isResolvable: boolean;
}) {
  const longTextBlock = input.longDescription
    ? `Langtext:\n${input.longDescription}`
    : "Langtext: (nicht vorhanden)";

  const contextBlock = input.context ? `Aktueller Anlass/Update-Hinweis:\n${input.context}` : "";

  return [
    "Du bist ein neutraler Redaktionsassistent fuer Future-Vote.",
    "Erzeuge EINEN kurzen, konkreten Update-Text fuer eine bereits laufende Frage.",
    "",
    "Regeln:",
    "- Schreibe auf Deutsch mit Umlauten.",
    "- Neutral, faktenbasiert, kein Clickbait.",
    "- 2 bis 5 Absätze.",
    "- Erlaubte Formatierung: **fett**, __unterstrichen__, [size=lg]...[/size] sparsam und nur wenn sinnvoll.",
    "- Keine erfundenen Fakten.",
    "- Wenn moeglich: 1-4 serioese Quellen als sourceUrls[] angeben (URLs). sourceUrl soll die erste Quelle sein; wenn keine Quelle vorhanden ist: sourceUrl=null und sourceUrls=[].",
    "- Wenn Quellen unklar sind, benenne das transparent im Text.",
    "",
    "Antworte NUR als JSON (ohne Markdown):",
    "{\"body\":\"...\",\"sourceUrl\":\"https://...|null\",\"sourceUrls\":[\"https://...\"],\"sources\":[\"https://...\"]}",
    "",
    "Frage-Kontext:",
    `Titel: ${input.title}`,
    `Kategorie: ${input.category}`,
    `Region: ${input.region ?? "Global"}`,
    `Typ: ${input.isResolvable ? "Prognose" : "Meinungs-Umfrage"}`,
    "",
    `Kurzbeschreibung:\n${input.shortDescription || "(leer)"}`,
    "",
    longTextBlock,
    contextBlock ? "" : "",
    contextBlock,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function POST(request: Request) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
  }

  const suggestRate = await consumeRateLimit({
    request,
    scope: "admin-ai-suggestion",
    identifier: `user:${user.id}`,
    limit: 30,
    windowSeconds: 60 * 60,
  });
  if (!suggestRate.allowed) {
    return rateLimitResponse(suggestRate, "KI-Limit erreicht. Bitte später erneut versuchen.");
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const questionId = String(body.questionId ?? "").trim();
  if (!questionId) {
    return NextResponse.json({ error: "questionId fehlt." }, { status: 400 });
  }

  const question = await getQuestionByIdFromSupabase(questionId).catch(() => null);
  if (!question || question.visibility !== "public") {
    return NextResponse.json({ error: "Frage nicht gefunden." }, { status: 404 });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "PERPLEXITY_API_KEY ist nicht gesetzt." }, { status: 500 });
  }

  const model = process.env.PERPLEXITY_MODEL?.trim() || "sonar-pro";
  const context = typeof body.context === "string" ? body.context.trim().slice(0, 2000) : "";
  const description = splitDescriptionText(question.description ?? null);

  const prompt = buildPrompt({
    title: question.title,
    category: question.category,
    region: question.region ?? null,
    shortDescription: description.shortText,
    longDescription: description.longText,
    context,
    isResolvable: question.isResolvable ?? true,
  });

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 900,
      messages: [
        { role: "system", content: "Du antwortest strikt als JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const json = (await res.json().catch(() => null)) as
    | { error?: { message?: string }; message?: string; choices?: Array<{ message?: { content?: string } }> }
    | null;
  if (!res.ok) {
    const msg = json?.error?.message ?? json?.message ?? `Perplexity Fehler (${res.status})`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Perplexity hat keine Antwort geliefert." }, { status: 502 });
  }

  const parsed = safeJsonFromText(content);
  const suggestion = normalizeSuggestion(parsed);
  if (!suggestion) {
    return NextResponse.json(
      { error: "KI-Antwort konnte nicht als gültiges JSON gelesen werden.", raw: content.slice(0, 1500) },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, suggestion }, { status: 200 });
}
