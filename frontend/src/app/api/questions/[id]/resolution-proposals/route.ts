import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getQuestionByIdFromSupabase } from "@/app/data/dbSupabase";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { consumeRateLimit, mutationRequestGuard, rateLimitResponse } from "@/app/lib/requestSecurity";
import { isRecord } from "@/app/lib/unknownValue";

export const revalidate = 0;

type Outcome = "yes" | "no";

type ProposalRow = {
  user_id: string;
  suggested_outcome: Outcome;
  source_url: string;
  note: string | null;
  created_at: string;
  updated_at: string;
};

type RawProposalRow = {
  user_id: string | null;
  suggested_outcome: string | null;
  source_url: string | null;
  note: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function normalizeProposalRows(data: unknown): ProposalRow[] {
  if (!Array.isArray(data)) return [];
  return (data as RawProposalRow[]).map((r) => ({
    user_id: String(r.user_id ?? ""),
    suggested_outcome: r.suggested_outcome === "no" ? "no" : "yes",
    source_url: String(r.source_url ?? ""),
    note: typeof r.note === "string" ? r.note : null,
    created_at: String(r.created_at ?? ""),
    updated_at: String(r.updated_at ?? ""),
  }));
}

function todayUtcDateIso() {
  return new Date().toISOString().slice(0, 10);
}

function normalizeOutcome(input: unknown): Outcome | null {
  return input === "yes" || input === "no" ? input : null;
}

function normalizeSourceUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (trimmed.length > 500) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeNote(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 500);
}

function computeStats(rows: ProposalRow[], currentUserId: string | null) {
  let yes = 0;
  let no = 0;
  let mine: { outcome: Outcome; sourceUrl: string; note: string | null } | null = null;

  for (const r of rows) {
    if (r.suggested_outcome === "yes") yes += 1;
    if (r.suggested_outcome === "no") no += 1;
    if (currentUserId && r.user_id === currentUserId) {
      mine = { outcome: r.suggested_outcome, sourceUrl: r.source_url, note: r.note ?? null };
    }
  }

  const total = yes + no;
  const majority: Outcome | null = yes === no ? null : yes > no ? "yes" : "no";
  const majorityCount = majority ? (majority === "yes" ? yes : no) : 0;

  return { yes, no, total, majority, majorityCount, mine };
}

function uniqueSourcesForOutcome(rows: ProposalRow[], outcome: Outcome): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const r of rows) {
    if (r.suggested_outcome !== outcome) continue;
    const u = String(r.source_url || "").trim();
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    result.push(u);
    if (result.length >= 6) break;
  }
  return result;
}

function shouldCreateCommunitySuggestion(stats: { total: number; majority: Outcome | null; majorityCount: number }, sourcesMajority: string[]) {
  if (stats.total < 3) return false;
  if (!stats.majority) return false;
  if (stats.majorityCount >= 3) return true;
  // Bei nur 2 Stimmen Mehrheit: mindestens 2 unabhängige Quellen, damit es nicht zufällig/unsicher ist.
  return sourcesMajority.length >= 2;
}

async function maybeCreateCommunitySuggestion(options: {
  questionId: string;
  createdByUserId: string;
  rows: ProposalRow[];
}) {
  const supabase = getSupabaseAdminClient();
  const stats = computeStats(options.rows, null);
  if (!stats.majority) return { created: false as const };

  const sourcesMajority = uniqueSourcesForOutcome(options.rows, stats.majority);
  if (!shouldCreateCommunitySuggestion(stats, sourcesMajority)) return { created: false as const };

  const nowIso = new Date().toISOString();
  const confidence = Math.max(0, Math.min(100, Math.round((stats.majorityCount / Math.max(1, stats.total)) * 100)));
  const note = `Community-Vorschläge: Ja ${stats.yes}, Nein ${stats.no} (n=${stats.total}).`;

  const { error } = await supabase.from("question_resolution_suggestions").insert({
    question_id: options.questionId,
    source_kind: "community",
    created_by_user_id: options.createdByUserId,
    status: "pending",
    suggested_outcome: stats.majority,
    confidence,
    note,
    sources: sourcesMajority,
    model: null,
    raw_response: null,
    error: null,
    updated_at: nowIso,
    last_attempt_at: nowIso,
  });

  // Unique pending (question_id, source_kind) => wenn schon da, ist das ok.
  if (error) return { created: false as const };
  return { created: true as const };
}

export async function GET(_request: Request, props: { params: Promise<{ id: string }> }) {
  const resolved = await props.params;
  const questionId = resolved?.id;
  if (!questionId) return NextResponse.json({ error: "ID fehlt." }, { status: 400 });

  const question = await getQuestionByIdFromSupabase(questionId).catch(() => null);
  if (!question || question.visibility !== "public") {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }
  if ((question.answerMode ?? "binary") === "options") {
    return NextResponse.json(
      { error: "Aufl\u00f6sungs-Vorschl\u00e4ge sind nur f\u00fcr Ja/Nein-Prognosen verf\u00fcgbar." },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId).catch(() => null) : null;

  const ended = String(question.closesAt).slice(0, 10) < todayUtcDateIso();
  const resolvedOutcome = question.resolvedOutcome === "yes" || question.resolvedOutcome === "no" ? question.resolvedOutcome : null;
  const eligible = ended && !resolvedOutcome;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("question_resolution_proposals")
    .select("user_id,suggested_outcome,source_url,note,created_at,updated_at")
    .eq("question_id", questionId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    const code = error.code;
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Supabase table 'question_resolution_proposals' fehlt. Fuehre supabase/question_resolution_proposals.sql aus." },
        { status: 500 }
      );
    }
    console.error("Resolution proposals list failed", error);
    return NextResponse.json({ error: "Aufloesungsvorschlaege konnten nicht geladen werden." }, { status: 500 });
  }

  const rows = normalizeProposalRows(data);

  const stats = computeStats(rows, user?.id ?? null);
  const majoritySources = stats.majority ? uniqueSourcesForOutcome(rows, stats.majority) : [];
  const queueReady = shouldCreateCommunitySuggestion(stats, majoritySources);
  return NextResponse.json(
    {
      ok: true,
      eligible,
      ended,
      resolvedOutcome,
      counts: { yes: stats.yes, no: stats.no, total: stats.total },
      mine: stats.mine,
      queueReady,
      majoritySourcesCount: majoritySources.length,
      canPropose: Boolean(user?.emailVerified),
    },
    { status: 200 }
  );
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const invalidSource = mutationRequestGuard(request);
  if (invalidSource) return invalidSource;

  const resolved = await props.params;
  const questionId = resolved?.id;
  if (!questionId) return NextResponse.json({ error: "ID fehlt." }, { status: 400 });

  const question = await getQuestionByIdFromSupabase(questionId).catch(() => null);
  if (!question || question.visibility !== "public") {
    return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  }
  if ((question.answerMode ?? "binary") === "options") {
    return NextResponse.json(
      { error: "Aufl\u00f6sungs-Vorschl\u00e4ge sind nur f\u00fcr Ja/Nein-Prognosen verf\u00fcgbar." },
      { status: 400 }
    );
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) return NextResponse.json({ error: "Bitte einloggen." }, { status: 401 });

  const user = await getUserBySessionSupabase(sessionId).catch(() => null);
  if (!user) return NextResponse.json({ error: "Bitte einloggen." }, { status: 401 });
  if (!user.emailVerified) return NextResponse.json({ error: "Bitte zuerst E-Mail bestätigen." }, { status: 403 });

  const proposalRate = await consumeRateLimit({
    request,
    scope: "resolution-proposal",
    identifier: `user:${user.id}`,
    limit: 20,
    windowSeconds: 24 * 60 * 60,
  });
  if (!proposalRate.allowed) {
    return rateLimitResponse(proposalRate, "Zu viele Auflösungsvorschläge. Bitte später erneut versuchen.");
  }

  const ended = String(question.closesAt).slice(0, 10) < todayUtcDateIso();
  const resolvedOutcome = question.resolvedOutcome === "yes" || question.resolvedOutcome === "no" ? question.resolvedOutcome : null;
  if (!ended) return NextResponse.json({ error: "Diese Frage ist noch nicht beendet." }, { status: 400 });
  if (resolvedOutcome) return NextResponse.json({ error: "Diese Frage ist bereits aufgeloest." }, { status: 400 });

  const rawBody: unknown = await request.json().catch(() => null);
  const body = isRecord(rawBody) ? rawBody : {};
  const outcome = normalizeOutcome(body.outcome);
  const sourceUrl = normalizeSourceUrl(body.sourceUrl);
  const note = normalizeNote(body.note);

  if (!outcome) return NextResponse.json({ error: "Bitte Ja oder Nein auswählen." }, { status: 400 });
  if (!sourceUrl) return NextResponse.json({ error: "Bitte eine gueltige Quelle (URL) angeben." }, { status: 400 });

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { error: upsertErr } = await supabase
    .from("question_resolution_proposals")
    .upsert(
      {
        question_id: questionId,
        user_id: user.id,
        suggested_outcome: outcome,
        source_url: sourceUrl,
        note,
        updated_at: nowIso,
      },
      { onConflict: "question_id,user_id" }
    );

  if (upsertErr) {
    const code = upsertErr.code;
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Supabase table 'question_resolution_proposals' fehlt. Fuehre supabase/question_resolution_proposals.sql aus." },
        { status: 500 }
      );
    }
    console.error("Resolution proposal save failed", upsertErr);
    return NextResponse.json({ error: "Aufloesungsvorschlag konnte nicht gespeichert werden." }, { status: 500 });
  }

  // Neu laden, damit wir konsistente Zaehler + sources haben
  const { data: rows, error: listErr } = await supabase
    .from("question_resolution_proposals")
    .select("user_id,suggested_outcome,source_url,note,created_at,updated_at")
    .eq("question_id", questionId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (listErr) {
    console.error("Resolution proposals reload failed", listErr);
    return NextResponse.json({ error: "Aufloesungsvorschlaege konnten nicht geladen werden." }, { status: 500 });
  }

  const normalizedRows = normalizeProposalRows(rows);

  const createdSuggestion = await maybeCreateCommunitySuggestion({
    questionId,
    createdByUserId: user.id,
    rows: normalizedRows,
  }).catch(() => ({ created: false as const }));

  const stats = computeStats(normalizedRows, user.id);
  const majoritySources = stats.majority ? uniqueSourcesForOutcome(normalizedRows, stats.majority) : [];
  const queueReady = shouldCreateCommunitySuggestion(stats, majoritySources);
  return NextResponse.json(
    {
      ok: true,
      createdSuggestion: createdSuggestion.created,
      counts: { yes: stats.yes, no: stats.no, total: stats.total },
      mine: stats.mine,
      queueReady,
      majoritySourcesCount: majoritySources.length,
    },
    { status: 200 }
  );
}
