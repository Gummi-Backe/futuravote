import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";

export const revalidate = 0;

type Body = {
  questionId?: string;
  context?: string;
};

type Suggestion = {
  suggestedOutcome: "yes" | "no" | "unknown";
  suggestedOptionId: string | null;
  confidence: number;
  note: string;
  sources: string[];
};

type ResolutionQuestionRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  region: string | null;
  closes_at: string | null;
  resolution_criteria: string | null;
  resolution_source: string | null;
  resolution_deadline: string | null;
  answer_mode: string | null;
  is_resolvable: boolean | null;
};

type ResolutionOptionRow = { id: string; label: string | null; sort_order: number | null };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeJsonFromText(text: string): unknown {
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

function normalizeSuggestion(raw: unknown, opts: { answerMode: "binary" | "options"; validOptionIds?: string[] }): Suggestion | null {
  const data = isRecord(raw) ? raw : {};
  const outcome = data.suggestedOutcome;
  let suggestedOutcome: Suggestion["suggestedOutcome"] =
    outcome === "yes" || outcome === "no" || outcome === "unknown" ? outcome : "unknown";

  const suggestedOptionIdRaw = data.suggestedOptionId;
  const suggestedOptionIdText = typeof suggestedOptionIdRaw === "string" ? suggestedOptionIdRaw.trim() : "";
  const validOptionIds = new Set((opts.validOptionIds ?? []).map((v) => String(v)));
  let suggestedOptionId: string | null =
    suggestedOptionIdText && validOptionIds.has(suggestedOptionIdText) ? suggestedOptionIdText : null;

  if (opts.answerMode === "binary") {
    suggestedOptionId = null;
  } else {
    suggestedOutcome = "unknown";
  }

  const confidenceRaw = Number(data.confidence);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(100, Math.round(confidenceRaw))) : 0;

  const note = typeof data.note === "string" ? data.note.trim() : "";

  const sourcesRaw: unknown[] = Array.isArray(data.sources) ? data.sources : [];
  const sources = sourcesRaw
    .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);

  if (!note && sources.length === 0 && suggestedOutcome === "unknown" && !suggestedOptionId) return null;

  return { suggestedOutcome, suggestedOptionId, confidence, note, sources };
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

  const questionId = (body.questionId ?? "").trim();
  if (!questionId) {
    return NextResponse.json({ error: "Fragen-ID fehlt." }, { status: 400 });
  }

  const context = typeof body.context === "string" ? body.context.trim().slice(0, 2000) : "";

  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "PERPLEXITY_API_KEY ist nicht gesetzt." }, { status: 500 });
  }

  const supabase = getSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from("questions")
    .select(
      "id,title,description,category,region,closes_at,resolution_criteria,resolution_source,resolution_deadline,answer_mode,is_resolvable"
    )
    .eq("id", questionId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `Supabase Fehler: ${error.message}` }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Frage nicht gefunden." }, { status: 404 });
  }
  const question = row as ResolutionQuestionRow;

  const model = process.env.PERPLEXITY_MODEL?.trim() || "sonar-pro";

  if (question.is_resolvable === false) {
    return NextResponse.json({ ok: false, error: "Diese Frage ist keine Prognose und kann nicht aufgeloest werden." }, { status: 400 });
  }

  const answerMode: "binary" | "options" = question.answer_mode === "options" ? "options" : "binary";
  const optionsRes =
    answerMode === "options"
      ? await supabase
          .from("question_options")
          .select("id,label,sort_order")
          .eq("question_id", questionId)
          .order("sort_order", { ascending: true })
      : null;

  if (answerMode === "options" && optionsRes?.error) {
    return NextResponse.json({ ok: false, error: `Optionen konnten nicht geladen werden: ${optionsRes.error.message}` }, { status: 500 });
  }

  const optionsList: ResolutionOptionRow[] =
    answerMode === "options" ? ((optionsRes?.data ?? []) as ResolutionOptionRow[]) : [];
  const optionLines =
    answerMode === "options"
      ? [
          "",
          "Antwortoptionen (du MUSST eine dieser IDs wählen oder null):",
          ...optionsList.map((o) => `- ${String(o.id)} | ${String(o.label ?? "")}`),
        ]
      : [];

  const contextLines =
    context.length > 0
      ? [
          "",
          "Admin-Hinweise (unbestätigt, bitte verifizieren):",
          context,
        ]
      : [];

  const prompt =
    answerMode === "binary"
      ? [
          "Du bist ein Recherche-Assistent fuer die Aufloesung von Prognosefragen (Ja/Nein).",
          "Nutze Web-Recherche, liefere 2-5 gute Quellen-Links und gib einen Vorschlag fuer das echte Ergebnis.",
          "",
          "WICHTIG:",
          "- Antworte NUR als JSON (ohne Markdown, ohne Text davor/danach).",
          "- Wenn du das Ergebnis nicht sicher bestimmen kannst: suggestedOutcome = \"unknown\".",
          "- Quellen muessen als URLs in sources stehen.",
          "- Berücksichtige Admin-Hinweise nur als Ausgangspunkt und verifiziere sie über offizielle Quellen.",
          "",
          "JSON Format:",
          "{\"suggestedOutcome\":\"yes|no|unknown\",\"suggestedOptionId\":null,\"confidence\":0-100,\"note\":\"kurze Begruendung (DE)\",\"sources\":[\"https://...\"]}",
          "",
          "Frage:",
          `- Titel: ${String(question.title ?? "")}`,
          `- Beschreibung: ${String(question.description ?? "")}`,
          `- Kategorie: ${String(question.category ?? "")}`,
          `- Region: ${String(question.region ?? "")}`,
          `- Voting-Ende (closes_at): ${String(question.closes_at ?? "")}`,
          `- Aufloesungs-Regeln: ${String(question.resolution_criteria ?? "")}`,
          `- Quelle-Hinweis: ${String(question.resolution_source ?? "")}`,
          `- Aufloesungs-Deadline: ${String(question.resolution_deadline ?? "")}`,
          ...contextLines,
        ].join("\n")
      : [
          "Du bist ein Recherche-Assistent fuer die Aufloesung von Prognosefragen (Optionen).",
          "Nutze Web-Recherche, liefere 2-5 gute Quellen-Links und gib einen Vorschlag fuer die richtige Gewinner-Option.",
          "",
          "WICHTIG:",
          "- Antworte NUR als JSON (ohne Markdown, ohne Text davor/danach).",
          "- Wenn du das Ergebnis nicht sicher bestimmen kannst: suggestedOutcome = \"unknown\" und suggestedOptionId = null.",
          "- suggestedOptionId MUSS exakt eine der unten stehenden IDs sein (oder null).",
          "- Quellen muessen als URLs in sources stehen.",
          "- Berücksichtige Admin-Hinweise nur als Ausgangspunkt und verifiziere sie über offizielle Quellen.",
          "",
          "JSON Format:",
          "{\"suggestedOutcome\":\"unknown\",\"suggestedOptionId\":\"uuid|null\",\"confidence\":0-100,\"note\":\"kurze Begruendung (DE)\",\"sources\":[\"https://...\"]}",
          "",
          "Frage:",
          `- Titel: ${String(question.title ?? "")}`,
          `- Beschreibung: ${String(question.description ?? "")}`,
          `- Kategorie: ${String(question.category ?? "")}`,
          `- Region: ${String(question.region ?? "")}`,
          `- Voting-Ende (closes_at): ${String(question.closes_at ?? "")}`,
          `- Aufloesungs-Regeln: ${String(question.resolution_criteria ?? "")}`,
          `- Quelle-Hinweis: ${String(question.resolution_source ?? "")}`,
          `- Aufloesungs-Deadline: ${String(question.resolution_deadline ?? "")}`,
          ...optionLines,
          ...contextLines,
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

  const json: unknown = await res.json().catch(() => null);
  const responseData = isRecord(json) ? json : {};
  if (!res.ok) {
    const responseError = isRecord(responseData.error) ? responseData.error : {};
    const msg =
      (typeof responseError.message === "string" ? responseError.message : null) ??
      (typeof responseData.message === "string" ? responseData.message : null) ??
      `Perplexity Fehler (${res.status})`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  const firstChoice = Array.isArray(responseData.choices) && isRecord(responseData.choices[0]) ? responseData.choices[0] : {};
  const responseMessage = isRecord(firstChoice.message) ? firstChoice.message : {};
  const content = responseMessage.content;
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Perplexity hat keine Antwort geliefert." }, { status: 502 });
  }

  const parsed = safeJsonFromText(content.trim());
  const suggestion = normalizeSuggestion(parsed, {
    answerMode,
    validOptionIds: answerMode === "options" ? optionsList.map((o) => String(o.id)) : undefined,
  });
  if (!suggestion) {
    return NextResponse.json(
      { error: "KI-Antwort konnte nicht als JSON gelesen werden.", raw: content.slice(0, 1500) },
      { status: 502 }
    );
  }

  return NextResponse.json({ ok: true, suggestion });
}
