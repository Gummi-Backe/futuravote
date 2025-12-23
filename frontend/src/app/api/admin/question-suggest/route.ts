import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { categories } from "@/app/data/mock";

export const revalidate = 0;

type Body = {
  category?: string;
  region?: string;
  theme?: string;
  count?: number;
  isResolvable?: boolean;
  answerMode?: "binary" | "options";
  visibility?: "public" | "link_only";
};

export type QuestionSuggestion = {
  title: string;
  description: string;
  category: string;
  region: string | null;
  isResolvable: boolean;
  answerMode: "binary" | "options";
  options: string[];
  imagePrompt: string;
  reviewHours: number;
  pollEndAt: string;
  resolutionCriteria: string;
  resolutionSource: string;
  resolutionDeadlineAt: string;
  sources: string[];
};

function safeJsonFromText(text: string): any | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim()
    .replace(/[“”]/g, "\"");

  const escapeControlCharsInJsonStrings = (input: string) => {
    let out = "";
    let inString = false;
    let escaping = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i]!;

      if (escaping) {
        out += ch;
        escaping = false;
        continue;
      }

      if (ch === "\\") {
        out += ch;
        escaping = true;
        continue;
      }

      if (ch === "\"") {
        out += ch;
        inString = !inString;
        continue;
      }

      if (inString) {
        if (ch === "\n") {
          out += "\\n";
          continue;
        }
        if (ch === "\r") {
          out += "\\r";
          continue;
        }
        if (ch === "\t") {
          out += "\\t";
          continue;
        }
      }

      out += ch;
    }
    return out;
  };

  const tryParse = (candidate: string) => {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(escapeControlCharsInJsonStrings(candidate));
      } catch {
        return null;
      }
    }
  };

  // 1) direct
  const direct = tryParse(cleaned);
  if (direct) return direct;

  // 2) object slice
  const objStart = cleaned.indexOf("{");
  const objEnd = cleaned.lastIndexOf("}");
  if (objStart >= 0 && objEnd > objStart) {
    const sliced = tryParse(cleaned.slice(objStart, objEnd + 1));
    if (sliced) return sliced;
  }

  // 3) salvage: extract completed objects from a truncated suggestions array
  const lower = cleaned.toLowerCase();
  const keyIdx = lower.indexOf("\"suggestions\"");
  if (keyIdx >= 0) {
    const arrayStart = cleaned.indexOf("[", keyIdx);
    if (arrayStart >= 0) {
      const objects: any[] = [];
      let inString = false;
      let escaping = false;
      let depth = 0;
      let objSliceStart = -1;

      for (let i = arrayStart + 1; i < cleaned.length; i++) {
        const ch = cleaned[i]!;

        if (escaping) {
          escaping = false;
          continue;
        }
        if (ch === "\\") {
          escaping = true;
          continue;
        }
        if (ch === "\"") {
          inString = !inString;
          continue;
        }
        if (inString) continue;

        if (ch === "{") {
          if (depth === 0) objSliceStart = i;
          depth++;
          continue;
        }
        if (ch === "}") {
          if (depth > 0) depth--;
          if (depth === 0 && objSliceStart >= 0) {
            const slice = cleaned.slice(objSliceStart, i + 1);
            const parsed = tryParse(slice);
            if (parsed) objects.push(parsed);
            objSliceStart = -1;
          }
          continue;
        }
      }

      if (objects.length > 0) return { suggestions: objects };
    }
  }

  return null;
}

function normalizeSuggestion(
  raw: any,
  defaults?: { isResolvable?: boolean; answerMode?: "binary" | "options" },
): QuestionSuggestion | null {
  const title = typeof raw?.title === "string" ? raw.title.trim() : "";
  const description = typeof raw?.description === "string" ? raw.description.trim() : "";
  const category = typeof raw?.category === "string" ? raw.category.trim() : "";
  const region = typeof raw?.region === "string" ? raw.region.trim() : "";

  const isResolvableRaw = raw?.isResolvable ?? raw?.is_resolvable;
  const isResolvable =
    typeof isResolvableRaw === "boolean"
      ? isResolvableRaw
      : typeof defaults?.isResolvable === "boolean"
        ? defaults.isResolvable
        : true;

  const answerModeRaw = raw?.answerMode ?? raw?.answer_mode;
  const answerMode: "binary" | "options" =
    answerModeRaw === "options" || answerModeRaw === "binary"
      ? answerModeRaw
      : defaults?.answerMode === "options"
        ? "options"
        : "binary";

  const optionsRaw: unknown[] = Array.isArray(raw?.options) ? (raw.options as unknown[]) : [];
  const options =
    answerMode === "options"
      ? optionsRaw
          .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
          .filter(Boolean)
          .map((s) => s.slice(0, 80))
          .slice(0, 6)
      : [];

  const uniqueOptions = (() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const o of options) {
      const key = o.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(o);
      if (out.length >= 6) break;
    }
    return out;
  })();

  const reviewHoursRaw = Number(raw?.reviewHours);
  const reviewHours = Number.isFinite(reviewHoursRaw)
    ? Math.max(12, Math.min(24 * 30, Math.round(reviewHoursRaw)))
    : 72;

  const pollEndAt = typeof raw?.pollEndAt === "string" ? raw.pollEndAt.trim() : "";
  const resolutionCriteria = typeof raw?.resolutionCriteria === "string" ? raw.resolutionCriteria.trim() : "";
  const resolutionSource = typeof raw?.resolutionSource === "string" ? raw.resolutionSource.trim() : "";
  const resolutionDeadlineAt = typeof raw?.resolutionDeadlineAt === "string" ? raw.resolutionDeadlineAt.trim() : "";

  const sourcesRaw: unknown[] = Array.isArray(raw?.sources) ? (raw.sources as unknown[]) : [];
  const sources = sourcesRaw
    .map((s: unknown) => (typeof s === "string" ? s.trim() : ""))
    .filter(Boolean)
    .slice(0, 6);

  const imagePrompt = typeof raw?.imagePrompt === "string" ? raw.imagePrompt.trim() : "";
  const normalizedImagePrompt = imagePrompt.length >= 20 ? imagePrompt.slice(0, 900) : "";

  if (!title || title.length < 8) return null;
  if (!description || description.length < 20) return null;
  if (!category) return null;
  if (!pollEndAt || Number.isNaN(Date.parse(pollEndAt))) return null;
  if (answerMode === "options" && uniqueOptions.length < 2) return null;
  if (isResolvable) {
    if (!resolutionCriteria || resolutionCriteria.length < 10) return null;
    if (!resolutionSource) return null;
    if (!resolutionDeadlineAt || Number.isNaN(Date.parse(resolutionDeadlineAt))) return null;
  }

  return {
    title: title.slice(0, 180),
    description: description.slice(0, 2500),
    category: category.slice(0, 80),
    region: region ? region.slice(0, 100) : null,
    isResolvable,
    answerMode,
    options: uniqueOptions,
    imagePrompt: normalizedImagePrompt,
    reviewHours,
    pollEndAt,
    resolutionCriteria: (isResolvable ? resolutionCriteria : "").slice(0, 2000),
    resolutionSource: (isResolvable ? resolutionSource : "").slice(0, 500),
    resolutionDeadlineAt: isResolvable ? resolutionDeadlineAt : "",
    sources,
  };
}

function buildPrompt(opts: {
  category?: string;
  region?: string;
  theme?: string;
  count: number;
  allowedCategories: string[];
  avoidTitles?: string[];
  requestedIsResolvable?: boolean;
  requestedAnswerMode?: "binary" | "options";
  requestedVisibility?: "public" | "link_only";
}): string {
  const category = (opts.category ?? "").trim();
  const region = (opts.region ?? "").trim();
  const theme = (opts.theme ?? "").trim();
  const avoidTitles = (opts.avoidTitles ?? []).map((t) => t.trim()).filter(Boolean).slice(0, 12);

  const constraintLines = [
    typeof opts.requestedVisibility === "string"
      ? `- Sichtbarkeit: ${opts.requestedVisibility === "public" ? "Öffentlich" : "Privat (nur per Link)"}`
      : "",
    typeof opts.requestedIsResolvable === "boolean"
      ? `- Typ: ${opts.requestedIsResolvable ? "Prognose (isResolvable=true)" : "Meinungs-Umfrage (isResolvable=false)"}`
      : "",
    typeof opts.requestedAnswerMode === "string"
      ? `- Antwortmodus: ${opts.requestedAnswerMode === "options" ? "Optionen (2-6, Single-Choice)" : "Ja/Nein (binary)"}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  return [
    "Du bist ein Recherche-Assistent fuer Fragen/Umfragen auf Future-Vote.",
    "Aufgabe: Erstelle serioese, eindeutige Vorschlaege. Es gibt Prognosen (aufloesbar, Punkte) und Meinungs-Umfragen (nicht aufloesbar).",
    "",
    "Eingabe (vom Admin):",
    category ? `- Kategorie-Wunsch: ${category}` : "- Kategorie-Wunsch: (frei)",
    region ? `- Region-Wunsch: ${region}` : "- Region-Wunsch: (optional)",
    theme ? `- Thema/Briefing: ${theme}` : "- Thema/Briefing: (leer)",
    constraintLines ? "- Vorgaben (MUSS):" : "",
    constraintLines,
    avoidTitles.length ? `- NICHT wiederholen (Titel): ${avoidTitles.join(" | ")}` : "",
    "",
    "WICHTIG:",
    "- Titel: klar, eindeutig, max. 140 Zeichen.",
    "- Beschreibung: 3-5 Saetze Kontext (DE), kurz halten, keine echten Zeilenumbrueche.",
    typeof opts.requestedIsResolvable === "boolean"
      ? `- Erstelle ausschliesslich ${
          opts.requestedIsResolvable ? "Prognosen (isResolvable=true)" : "Meinungs-Umfragen (isResolvable=false)"
        }.`
      : "- Entscheide pro Vorschlag: Prognose vs Meinungs-Umfrage.",
    typeof opts.requestedIsResolvable !== "boolean" || opts.requestedIsResolvable
      ? "- Bei Prognose: isResolvable=true und Aufloesung muss mit Quellen klar pruefbar sein."
      : "",
    typeof opts.requestedIsResolvable !== "boolean" || !opts.requestedIsResolvable
      ? "- Bei Meinungs-Umfrage: isResolvable=false und resolutionCriteria/resolutionSource/resolutionDeadlineAt als leere Strings setzen."
      : "",
    typeof opts.requestedAnswerMode === "string"
      ? `- Verwende fuer alle Vorschlaege answerMode='${opts.requestedAnswerMode}'.`
      : "- answerMode: 'binary' (Ja/Nein) oder 'options' (2-6 feste Optionen, Single-Choice).",
    typeof opts.requestedAnswerMode !== "string" || opts.requestedAnswerMode === "options"
      ? "- Bei answerMode='options': options muss 2-6 neutrale, klare Optionen enthalten (keine Duplikate)."
      : "",
    typeof opts.requestedAnswerMode === "string" && opts.requestedAnswerMode === "binary"
      ? "- Bei answerMode='binary': options als leeres Array setzen."
      : "",
    "- Zusaetzlich: imagePrompt (DE) fuer ein passendes Thumbnail-Bild: 2-4 Saetze, fotorealistisch wie ein journalistisches Foto (Szene, Ort, Objekte, Licht, Perspektive).",
    "- imagePrompt: KEINE Illustration/Icons/Clipart/Infografik. Keine Logos, keine Marken, keine Wasserzeichen, keine bekannten Personen, keine Politiker, keine Prominenten.",
    "- imagePrompt: Vermeide gut lesbaren Text. Falls Text unvermeidbar ist: nur sehr kurz und auf Deutsch.",
    "- Schreibe Deutsch mit Umlauten: ä, ö, ü, ß. Verwende NICHT ae/oe/ue/ss als Ersatz.",
    "- Bei Prognose: resolutionCriteria konkret, woran das Ergebnis festgemacht wird (bei Optionen: welche Option gilt als Gewinner).",
    "- sources: 2-4 URLs als Nachweis (offizielle Stellen/Institutionen/serioese Medien). Bei Meinungs-Umfrage optional.",
    "- pollEndAt: bis wann abgestimmt werden kann (nahe am Ereignis/Stichtag).",
    "- Bei Prognose: resolutionDeadlineAt spaetestens wann das echte Ergebnis pruefbar sein muss (>= pollEndAt, oft +1-3 Tage).",
    "- reviewHours: variiere sinnvoll (24,48,72,168,336).",
    "",
    "Kategorie-Regel:",
    `- Nutze als category nach Moeglichkeit einen dieser Werte: ${opts.allowedCategories.join(", ")}.`,
    "",
    "Antworte NUR als JSON (kein Markdown, kein Text davor/danach).",
    "WICHTIG: In JSON-Strings keine echten Zeilenumbrueche verwenden. Falls noetig, nutze \\n.",
    "Format:",
    `{"suggestions":[{"title":"...","description":"...","category":"...","region":"Global|Deutschland|Europa|DACH|Stuttgart|...","isResolvable":true,"answerMode":"binary|options","options":["..."],"imagePrompt":"...","reviewHours":72,"pollEndAt":"ISO-8601","resolutionCriteria":"(nur Prognose)","resolutionSource":"(nur Prognose)","resolutionDeadlineAt":"(nur Prognose)","sources":["https://..."]}]}`,
    "",
    `Erstelle genau ${opts.count} Vorschlaege.`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function callPerplexity(opts: { apiKey: string; model: string; prompt: string; maxTokens: number }) {
  const res = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${opts.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: opts.model,
      temperature: 0.2,
      max_tokens: opts.maxTokens,
      messages: [
        {
          role: "system",
          content:
            "Du antwortest strikt als JSON. Schreibe auf Deutsch.",
        },
        { role: "user", content: opts.prompt },
      ],
    }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (json as any)?.error?.message ?? (json as any)?.message ?? `Perplexity Fehler (${res.status})`;
    return { ok: false as const, error: msg };
  }

  const content = (json as any)?.choices?.[0]?.message?.content;
  const finishReason = String((json as any)?.choices?.[0]?.finish_reason ?? "");
  if (typeof content !== "string" || !content.trim()) {
    return { ok: false as const, error: "Perplexity hat keine Antwort geliefert." };
  }

  return { ok: true as const, content: content.trim(), finishReason };
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

  const theme = (body.theme ?? "").trim();
  const category = (body.category ?? "").trim();
  const region = (body.region ?? "").trim();

  if (body.answerMode && body.answerMode !== "binary" && body.answerMode !== "options") {
    return NextResponse.json({ error: "answerMode muss 'binary' oder 'options' sein." }, { status: 400 });
  }
  if (body.visibility && body.visibility !== "public" && body.visibility !== "link_only") {
    return NextResponse.json({ error: "visibility muss 'public' oder 'link_only' sein." }, { status: 400 });
  }

  const requestedIsResolvable = typeof body.isResolvable === "boolean" ? body.isResolvable : undefined;
  const requestedAnswerMode = body.answerMode === "binary" || body.answerMode === "options" ? body.answerMode : undefined;
  const requestedVisibility = body.visibility === "public" || body.visibility === "link_only" ? body.visibility : undefined;

  const countRaw = typeof body.count === "number" ? body.count : 1;
  const count = Math.max(1, Math.min(8, Math.round(Number.isFinite(countRaw) ? countRaw : 1)));

  if (!theme && !category) {
    return NextResponse.json({ error: "Bitte gib eine Kategorie oder ein Thema an." }, { status: 400 });
  }

  const apiKey = process.env.PERPLEXITY_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "PERPLEXITY_API_KEY ist nicht gesetzt." }, { status: 500 });
  }

  const model = process.env.PERPLEXITY_MODEL?.trim() || "sonar-pro";
  const allowedCategories = categories.map((c) => c.label).slice(0, 50);

  const collected: QuestionSuggestion[] = [];
  const seenTitles = new Set<string>();
  let lastRaw: string | null = null;
  let lastFinishReason: string | null = null;

  // Batching verhindert abgeschnittenes JSON (Token-Limit) bei vielen Vorschlägen.
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts && collected.length < count; attempt++) {
    const remaining = count - collected.length;
    const batchCount = Math.min(3, remaining);

    const prompt = buildPrompt({
      category: category || undefined,
      region: region || undefined,
      theme: theme || undefined,
      count: batchCount,
      allowedCategories,
      avoidTitles: collected.map((s) => s.title),
      requestedIsResolvable,
      requestedAnswerMode,
      requestedVisibility,
    });

    const resp = await callPerplexity({ apiKey, model, prompt, maxTokens: 2200 });
    if (!resp.ok) {
      return NextResponse.json({ error: resp.error }, { status: 502 });
    }
    lastRaw = resp.content;
    lastFinishReason = resp.finishReason;

    const parsed = safeJsonFromText(resp.content);
    const rawSuggestions: unknown[] = Array.isArray(parsed)
      ? (parsed as unknown[])
      : Array.isArray((parsed as any)?.suggestions)
        ? (((parsed as any).suggestions as unknown[]) ?? [])
        : [];

    const normalized = rawSuggestions
      .map((s: unknown) => normalizeSuggestion(s, { isResolvable: requestedIsResolvable, answerMode: requestedAnswerMode }))
      .filter(Boolean) as QuestionSuggestion[];

    const constrained = normalized.filter((s) => {
      if (typeof requestedIsResolvable === "boolean" && s.isResolvable !== requestedIsResolvable) return false;
      if (typeof requestedAnswerMode === "string" && s.answerMode !== requestedAnswerMode) return false;
      return true;
    });

    for (const s of constrained) {
      const key = s.title.trim().toLowerCase();
      if (!key) continue;
      if (seenTitles.has(key)) continue;
      seenTitles.add(key);
      collected.push(s);
      if (collected.length >= count) break;
    }

    if ((rawSuggestions.length === 0 || constrained.length === 0) && attempt < maxAttempts - 1) {
      continue;
    }

    if (rawSuggestions.length === 0 || constrained.length === 0) {
      const maybeCutOff =
        resp.finishReason.toLowerCase().includes("length") ||
        !resp.content.trim().endsWith("}") ||
        !resp.content.trim().endsWith("]");
      return NextResponse.json(
        {
          error: maybeCutOff
            ? "KI-Antwort scheint abgeschnitten zu sein (Token-Limit). Bitte Anzahl Vorschläge reduzieren oder erneut versuchen."
            : "KI-Antwort konnte nicht gelesen werden oder enthielt keine passenden Vorschl\u00e4ge. Bitte erneut versuchen.",
          raw: resp.content.slice(0, 1500),
        },
        { status: 502 }
      );
    }
  }

  if (collected.length === 0) {
    return NextResponse.json(
      {
        error: "Keine passenden Vorschl\u00e4ge erhalten.",
        raw: lastRaw ? lastRaw.slice(0, 1500) : null,
        finishReason: lastFinishReason,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({
    ok: true,
    suggestions: collected.slice(0, count),
    requestedCount: count,
    receivedCount: collected.length,
    partial: collected.length < count,
  });
}
