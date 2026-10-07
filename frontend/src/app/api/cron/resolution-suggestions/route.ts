import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { logAnalyticsEventServer } from "@/app/data/dbSupabaseAnalytics";
import { isRecord } from "@/app/lib/unknownValue";
import { isAuthorizedCronRequest } from "@/app/lib/cronAuth";
import { callFutureVoteTextAi, FUTUREVOTE_AI_MIN_CALL_MS, FUTUREVOTE_AI_REQUEST_BUDGET_MS, FUTUREVOTE_TEXT_MODEL, FUTUREVOTE_REASONING_EFFORT } from "@/app/lib/futureVoteTextAi";

export const revalidate = 0;
export const maxDuration = 300;

type Suggestion = {
  suggestedOutcome: "yes" | "no" | "unknown";
  suggestedOptionId: string | null;
  confidence: number;
  note: string;
  sources: string[];
};

type ResolutionCandidateRow = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  region: string | null;
  closes_at: string | null;
  resolution_criteria: string | null;
  resolution_source: string | null;
  resolution_deadline: string | null;
  visibility: string | null;
  resolved_outcome: string | null;
  resolved_option_id: string | null;
  answer_mode: string | null;
  is_resolvable: boolean | null;
};

type ResolutionOptionRow = { id: string; label: string | null; sort_order: number | null };
type PendingSuggestionRow = { question_id: string; source_kind: string | null };

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
    // Bei Options-Prognosen ist outcome nicht relevant (wir speichern winner als option_id).
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

export async function GET(request: Request) {
  const deadline = Date.now() + FUTUREVOTE_AI_REQUEST_BUDGET_MS;
  const url = new URL(request.url);
  const limitRaw = Number(url.searchParams.get("limit") ?? "25");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(60, Math.trunc(limitRaw))) : 25;
  const source = String(url.searchParams.get("source") ?? "").trim().slice(0, 40);

  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const trigger = source === "admin" ? "admin" : "vercel_cron";

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ ok: false, error: "OPENAI_API_KEY ist nicht gesetzt." }, { status: 500 });
  }
  const model = FUTUREVOTE_TEXT_MODEL;

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  // Kandidaten laden (mehr als limit, weil wir danach filtern).
  const { data: rows, error } = await supabase
    .from("questions")
    .select(
      "id,title,description,category,region,closes_at,resolution_criteria,resolution_source,resolution_deadline,visibility,resolved_outcome,resolved_option_id,answer_mode,is_resolvable"
    )
    .eq("visibility", "public")
    // Wichtig: Wir filtern nach "wirklich beendet" (Zeitstempel), nicht nur nach "vor heute".
    // Sonst würden Fragen, die heute schon abgelaufen sind, erst morgen in die Queue kommen.
    .lt("closes_at", nowIso)
    .limit(limit * 4);

  if (error) {
    return NextResponse.json({ ok: false, error: `Supabase Fehler: ${error.message}` }, { status: 500 });
  }

  const candidatesAll = ((rows ?? []) as ResolutionCandidateRow[]).filter((q) => {
    const isResolvable = q.is_resolvable === false ? false : true;
    if (!isResolvable) return false;
    const answerMode = q.answer_mode === "options" ? "options" : "binary";
    if (answerMode === "binary") {
      if (q.resolved_outcome === "yes" || q.resolved_outcome === "no") return false;
    } else {
      if (q.resolved_option_id) return false;
    }

    const deadline = q.resolution_deadline ? Date.parse(String(q.resolution_deadline)) : NaN;
    if (Number.isFinite(deadline)) return deadline <= Date.parse(nowIso);
    // Ohne Deadline: direkt nach Ende versuchen
    return true;
  });

  if (candidatesAll.length === 0) {
    const payload = { ok: true, checked: 0, considered: 0, created: 0, failed: 0, skippedExisting: 0, todayUtc: nowIso.slice(0, 10), nowUtc: nowIso };
    await logAnalyticsEventServer({
      event: "cron_resolution_suggestions_run",
      sessionId: "cron_resolution_suggestions",
      path: "/api/cron/resolution-suggestions",
      meta: { trigger, source: source || null, limit, ...payload },
    });
    return NextResponse.json({ ...payload, note: "Keine faelligen Fragen." });
  }

  // Bereits pending? (idempotent)
  const ids = candidatesAll.map((r) => String(r.id));
  const { data: pendingRows, error: pErr } = await supabase
    .from("question_resolution_suggestions")
    .select("question_id,source_kind")
    .eq("status", "pending")
    .in("question_id", ids);

  if (pErr) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Queue-Tabelle fehlt oder ist nicht erreichbar. Fuehre `supabase/question_resolution_suggestions.sql` in Supabase aus.",
        details: pErr.message,
      },
      { status: 500 }
    );
  }

  const pendingSet = new Set(
    ((pendingRows ?? []) as PendingSuggestionRow[]).map((r) => `${String(r.question_id)}|${String(r.source_kind ?? "ai")}`)
  );
  const candidates = candidatesAll
    .filter((q) => !pendingSet.has(`${String(q.id)}|ai`))
    .slice(0, limit);

  let created = 0;
  let failed = 0;
  let skippedExisting = candidatesAll.filter((q) => pendingSet.has(`${String(q.id)}|ai`)).length;
  let considered = 0;

  for (const q of candidates) {
    if (deadline - Date.now() < FUTUREVOTE_AI_MIN_CALL_MS) break;
    const questionId = String(q.id);

    const answerMode = q.answer_mode === "options" ? "options" : "binary";
    const optionRows =
      answerMode === "options"
        ? await supabase
            .from("question_options")
            .select("id,label,sort_order")
            .eq("question_id", questionId)
            .order("sort_order", { ascending: true })
        : null;

    if (answerMode === "options" && optionRows?.error) {
      considered += 1;
      await supabase.from("question_resolution_suggestions").insert({
        question_id: questionId,
        source_kind: "ai",
        status: "failed",
        suggested_outcome: "unknown",
        suggested_option_id: null,
        confidence: 0,
        note: null,
        sources: [],
        model,
        raw_response: null,
        error: `Optionen konnten nicht geladen werden: ${optionRows.error.message}`,
        updated_at: nowIso,
        last_attempt_at: nowIso,
      });
      failed += 1;
      continue;
    }

    const optionsList: ResolutionOptionRow[] =
      answerMode === "options" ? ((optionRows?.data ?? []) as ResolutionOptionRow[]) : [];
    const optionLines =
      answerMode === "options"
        ? [
            "",
            "Antwortoptionen (du MUSST eine dieser IDs wählen oder null):",
            ...optionsList.map((o) => `- ${String(o.id)} | ${String(o.label ?? "")}`),
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
            "",
            "JSON Format:",
            "{\"suggestedOutcome\":\"yes|no|unknown\",\"suggestedOptionId\":null,\"confidence\":0-100,\"note\":\"kurze Begruendung (DE)\",\"sources\":[\"https://...\"]}",
            "",
            "Frage:",
            `- ID: ${questionId}`,
            `- Titel: ${String(q.title ?? "")}`,
            `- Beschreibung: ${String(q.description ?? "")}`,
            `- Kategorie: ${String(q.category ?? "")}`,
            `- Region: ${String(q.region ?? "")}`,
            `- Voting-Ende (closes_at): ${String(q.closes_at ?? "")}`,
            `- Aufloesungs-Regeln: ${String(q.resolution_criteria ?? "")}`,
            `- Quelle-Hinweis: ${String(q.resolution_source ?? "")}`,
            `- Aufloesungs-Deadline: ${String(q.resolution_deadline ?? "")}`,
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
            "",
            "JSON Format:",
            "{\"suggestedOutcome\":\"unknown\",\"suggestedOptionId\":\"uuid|null\",\"confidence\":0-100,\"note\":\"kurze Begruendung (DE)\",\"sources\":[\"https://...\"]}",
            "",
            "Frage:",
            `- ID: ${questionId}`,
            `- Titel: ${String(q.title ?? "")}`,
            `- Beschreibung: ${String(q.description ?? "")}`,
            `- Kategorie: ${String(q.category ?? "")}`,
            `- Region: ${String(q.region ?? "")}`,
            `- Voting-Ende (closes_at): ${String(q.closes_at ?? "")}`,
            `- Aufloesungs-Regeln: ${String(q.resolution_criteria ?? "")}`,
            `- Quelle-Hinweis: ${String(q.resolution_source ?? "")}`,
            `- Aufloesungs-Deadline: ${String(q.resolution_deadline ?? "")}`,
            ...optionLines,
          ].join("\n");

    try {
      const timeoutMs = deadline - Date.now();
      if (timeoutMs < FUTUREVOTE_AI_MIN_CALL_MS) break;
      const resp = await callFutureVoteTextAi({ apiKey, prompt, maxTokens: 700, timeoutMs });
      if (!resp.ok) {
        // Transient provider limits must not create dozens of failed queue entries.
        if (resp.retryable) break;
        considered += 1;
        await supabase.from("question_resolution_suggestions").insert({
          question_id: questionId,
          source_kind: "ai",
          status: "failed",
          suggested_outcome: "unknown",
          confidence: 0,
          note: null,
          sources: [],
          model,
          raw_response: null,
          error: resp.error,
          updated_at: nowIso,
          last_attempt_at: nowIso,
        });
        failed += 1;
        break;
      }

      considered += 1;
      const parsed = safeJsonFromText(resp.content);
      const suggestion = normalizeSuggestion(parsed, {
        answerMode,
        validOptionIds: answerMode === "options" ? optionsList.map((o) => String(o.id)) : undefined,
      });
      if (!suggestion) {
        await supabase.from("question_resolution_suggestions").insert({
          question_id: questionId,
          source_kind: "ai",
          status: "failed",
          suggested_outcome: "unknown",
          suggested_option_id: null,
          confidence: 0,
          note: null,
          sources: [],
          model,
          raw_response: resp.content.slice(0, 6000),
          error: "KI-Antwort konnte nicht als JSON gelesen werden.",
          updated_at: nowIso,
          last_attempt_at: nowIso,
        });
        failed += 1;
        continue;
      }

      const { error: insErr } = await supabase.from("question_resolution_suggestions").insert({
        question_id: questionId,
        source_kind: "ai",
        status: "pending",
        suggested_outcome: suggestion.suggestedOutcome,
        suggested_option_id: suggestion.suggestedOptionId,
        confidence: suggestion.confidence,
        note: suggestion.note || null,
        sources: suggestion.sources,
        model,
        raw_response: resp.content.slice(0, 6000),
        error: null,
        updated_at: nowIso,
        last_attempt_at: nowIso,
      });

      // Bei Race (unique pending) einfach als "skipped" behandeln.
      if (insErr) {
        skippedExisting += 1;
      } else {
        created += 1;
      }
    } catch (e) {
      console.error("resolution-suggestions cron failed for question", questionId, e);
      failed += 1;
    }
  }

  return NextResponse.json({
    ...(await (async () => {
      const payload = {
        ok: true,
        checked: candidatesAll.length,
        considered,
        deferred: Math.max(0, candidatesAll.length - skippedExisting - created - failed),
        created,
        failed,
        skippedExisting,
        model,
        reasoningEffort: FUTUREVOTE_REASONING_EFFORT,
        todayUtc: nowIso.slice(0, 10),
        nowUtc: nowIso,
      };

      await logAnalyticsEventServer({
        event: "cron_resolution_suggestions_run",
        sessionId: "cron_resolution_suggestions",
        path: "/api/cron/resolution-suggestions",
        meta: { trigger, source: source || null, limit, ...payload },
      });

      return payload;
    })()),
  });
}
