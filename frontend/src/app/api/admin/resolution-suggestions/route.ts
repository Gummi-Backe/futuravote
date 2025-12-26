import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { adminResolveQuestionInSupabase } from "@/app/data/dbSupabase";

export const revalidate = 0;

type Status = "pending" | "applied" | "dismissed" | "failed";

type SuggestionRow = {
  id: string;
  question_id: string;
  source_kind: "ai" | "community";
  created_by_user_id: string | null;
  status: Status;
  suggested_outcome: "yes" | "no" | "unknown";
  suggested_option_id?: string | null;
  confidence: number;
  note: string | null;
  sources: string[] | null;
  model: string | null;
  created_at: string;
  questions?: any;
};

function isStatus(v: string): v is Status {
  return v === "pending" || v === "applied" || v === "dismissed" || v === "failed";
}

function formatResolvedNote(note: string | null, sources: string[] | null): string | null {
  const base = (note ?? "").trim();
  const list = (sources ?? []).filter(Boolean).slice(0, 6);
  const sourcesBlock = list.length ? `\n\nQuellen:\n${list.map((u) => `- ${u}`).join("\n")}` : "";
  const merged = `${base}${sourcesBlock}`.trim();
  if (!merged) return null;
  return merged.slice(0, 2000);
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
  }

  const url = new URL(request.url);
  const statusRaw = String(url.searchParams.get("status") ?? "pending");
  const status: Status = isStatus(statusRaw) ? statusRaw : "pending";

  const limitRaw = Number(url.searchParams.get("limit") ?? "100");
  const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(300, Math.trunc(limitRaw))) : 100;

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("question_resolution_suggestions")
    .select(
      "id,question_id,source_kind,created_by_user_id,status,suggested_outcome,suggested_option_id,confidence,note,sources,model,created_at,questions(id,title,closes_at,share_id,answer_mode,question_options(id,label,sort_order))"
    )
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: `Supabase Fehler: ${error.message}` }, { status: 500 });
  }

  const suggestions = ((data ?? []) as any[]).map((r) => {
    const q = Array.isArray(r.questions) ? r.questions[0] ?? null : r.questions ?? null;
    return {
      id: String(r.id),
      question_id: String(r.question_id),
      source_kind: r.source_kind === "community" ? "community" : "ai",
      created_by_user_id: r.created_by_user_id ? String(r.created_by_user_id) : null,
      status: r.status as Status,
      suggested_outcome: r.suggested_outcome as "yes" | "no" | "unknown",
      suggested_option_id: r.suggested_option_id ? String(r.suggested_option_id) : null,
      confidence: Number(r.confidence ?? 0) || 0,
      note: typeof r.note === "string" ? r.note : null,
      sources: Array.isArray(r.sources) ? (r.sources as any[]).map((s) => String(s)) : null,
      model: typeof r.model === "string" ? r.model : null,
      created_at: String(r.created_at),
      questions: q
        ? {
            id: String(q.id),
            title: q.title ? String(q.title) : null,
            closes_at: q.closes_at ? String(q.closes_at) : null,
            share_id: q.share_id ? String(q.share_id) : null,
            answer_mode: q.answer_mode ? String(q.answer_mode) : null,
            question_options: Array.isArray((q as any).question_options)
              ? (q as any).question_options.map((o: any) => ({ id: String(o.id), label: String(o.label ?? "") }))
              : [],
          }
        : null,
    } satisfies SuggestionRow;
  });

  return NextResponse.json({ ok: true, suggestions });
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const id = String(body?.id ?? "").trim();
  const action = String(body?.action ?? "").trim();
  if (!id || (action !== "apply" && action !== "dismiss")) {
    return NextResponse.json({ error: "ID oder Aktion fehlt/ungültig." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const nowIso = new Date().toISOString();

  const { data: row, error } = await supabase
    .from("question_resolution_suggestions")
    .select("id,question_id,source_kind,created_by_user_id,status,suggested_outcome,suggested_option_id,confidence,note,sources,model,created_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `Supabase Fehler: ${error.message}` }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "Vorschlag nicht gefunden." }, { status: 404 });
  }

  const suggestion = row as any as SuggestionRow;
  if (suggestion.status !== "pending") {
    return NextResponse.json({ error: "Vorschlag ist nicht mehr offen." }, { status: 400 });
  }

  if (action === "dismiss") {
    const { error: updErr } = await supabase
      .from("question_resolution_suggestions")
      .update({ status: "dismissed", updated_at: nowIso })
      .eq("id", id);
    if (updErr) {
      return NextResponse.json({ error: `Update fehlgeschlagen: ${updErr.message}` }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // apply
  const outcome = suggestion.suggested_outcome;
  const suggestedOptionId = (suggestion as any).suggested_option_id ? String((suggestion as any).suggested_option_id) : null;
  const resolvedOutcome = outcome === "yes" || outcome === "no" ? outcome : null;
  if (!suggestedOptionId && !resolvedOutcome) {
    return NextResponse.json({ error: "KI hat kein klares Ergebnis geliefert." }, { status: 400 });
  }

  const sources = (suggestion.sources ?? []).filter(Boolean);
  const resolvedSource = sources[0] ? String(sources[0]) : null;
  const resolvedNote = formatResolvedNote(suggestion.note ?? null, suggestion.sources ?? null);

  const question = await adminResolveQuestionInSupabase({
    id: String(suggestion.question_id),
    outcome: suggestedOptionId ? null : resolvedOutcome,
    resolvedOptionId: suggestedOptionId,
    resolvedSource,
    resolvedNote,
  });

  if (!question) {
    return NextResponse.json({ error: "Frage nicht gefunden." }, { status: 404 });
  }

  const { error: updErr } = await supabase
    .from("question_resolution_suggestions")
    .update({ status: "applied", updated_at: nowIso })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: `Update fehlgeschlagen: ${updErr.message}` }, { status: 500 });
  }

  // Andere offene Vorschlaege fuer diese Frage schliessen (damit die Queue sauber bleibt)
  await supabase
    .from("question_resolution_suggestions")
    .update({ status: "dismissed", updated_at: nowIso })
    .eq("question_id", String(suggestion.question_id))
    .eq("status", "pending")
    .neq("id", id);

  return NextResponse.json({ ok: true, question });
}
