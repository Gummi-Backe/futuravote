import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

type Body = {
  questionId?: string;
};

type Suggestion = {
  suggestedOutcome: "yes" | "no" | "unknown";
  confidence: number;
  note: string;
  sources: string[];
};

function safeJsonFromText(text: string): any | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function normalizeSuggestion(raw: any): Suggestion | null {
  const outcome = raw?.suggestedOutcome;
  const suggestedOutcome: Suggestion["suggestedOutcome"] =
    outcome === "yes" || outcome === "no" || outcome === "unknown" ? outcome : "unknown";

  const confidenceRaw = Number(raw?.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, Math.round(confidenceRaw))) : 0;

  const note = typeof raw?.note === "string" ? raw.note.trim() : "";

  const sourcesRaw: unknown[] = Array.isArray(raw?.sources) ? (raw.sources as unknown[]) : [];
  const sources = sourcesRaw
    .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);

  if (!note && sources.length === 0 && suggestedOutcome === "unknown") return null;

  return { suggestedOutcome, confidence, note, sources };
}

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

  const questionId = (body.questionId ?? "").trim();
  if (!questionId) {
    return NextResponse.json({ error: "Fragen-ID fehlt." }, { status: 400 });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "PERPLEXITY_API_KEY ist nicht gesetzt." }, { status: 500 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from("questions")
    .select(
      "id,title,description,category,region,closes_at,resolution_criteria,resolution_source,resolution_deadline"
    )
    .eq("id", questionId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `Supabase Fehler: ${error.message}` }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Frage nicht gefunden." }, { status: 404 });
  }

  const model = process.env.PERPLEXITY_MODEL?.trim() || "sonar-pro";

  const prompt = [
    "Du bist ein Recherche-Assistent fuer die Aufloesung von Prognosefragen (Ja/Nein).",
    "Nutze Web-Recherche, liefere 2-5 gute Quellen-Links und gib einen Vorschlag fuer das echte Ergebnis.",
    "",
    "WICHTIG:",
    "- Antworte NUR als JSON (ohne Markdown, ohne Text davor/danach).",
    "- Wenn du das Ergebnis nicht sicher bestimmen kannst: suggestedOutcome = \"unknown\".",
    "- Quellen muessen als URLs in sources stehen.",
    "",
    "JSON Format:",
    "{\"suggestedOutcome\":\"yes|no|unknown\",\"confidence\":0-100,\"note\":\"kurze Begruendung (DE)\",\"sources\":[\"https://...\"]}",
    "",
    "Frage:",
    `- Titel: ${String((row as any).title ?? "")}`,
    `- Beschreibung: ${String((row as any).description ?? "")}`,
    `- Kategorie: ${String((row as any).category ?? "")}`,
    `- Region: ${String((row as any).region ?? "")}`,
    `- Voting-Ende (closes_at): ${String((row as any).closes_at ?? "")}`,
    `- Aufloesungs-Regeln: ${String((row as any).resolution_criteria ?? "")}`,
    `- Quelle-Hinweis: ${String((row as any).resolution_source ?? "")}`,
    `- Aufloesungs-Deadline: ${String((row as any).resolution_deadline ?? "")}`,
  ].join("\n");

  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        { role: "system", content: "Du antwortest strikt als JSON." },
        { role: "user", content: prompt },
      ],
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      (json as any)?.error?.message ??
      (json as any)?.message ??
      `Perplexity Fehler (${res.status})`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const content = (json as any)?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Perplexity hat keine Antwort geliefert." }, { status: 502 });
  }

  const parsed = safeJsonFromText(content.trim());
  const suggestion = normalizeSuggestion(parsed);
  if (!suggestion) {
    return NextResponse.json(
      { error: "KI-Antwort konnte nicht als JSON gelesen werden.", raw: content.slice(0, 1500) },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, suggestion });
}
