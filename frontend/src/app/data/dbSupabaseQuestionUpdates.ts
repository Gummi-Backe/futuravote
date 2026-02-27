import "server-only";

import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export type QuestionUpdate = {
  id: string;
  questionId: string;
  userId: string;
  authorName: string;
  body: string;
  sourceUrl: string | null;
  sourceUrls: string[];
  createdAt: string;
};

type QuestionUpdateRow = {
  id: string;
  question_id: string;
  user_id: string;
  body: string;
  source_url: string | null;
  source_urls: string[] | null;
  created_at: string;
};

type UserDisplayRow = {
  id: string | null;
  display_name: string | null;
};

async function loadDisplayNames(userIds: string[]): Promise<Map<string, string>> {
  const supabase = getSupabaseAdminClient();
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  const names = new Map<string, string>();
  if (ids.length === 0) return names;

  const { data, error } = await supabase.from("users").select("id,display_name").in("id", ids);
  if (error) throw error;

  for (const row of (data ?? []) as UserDisplayRow[]) {
    const id = String(row.id ?? "");
    if (!id) continue;
    const displayName = String(row.display_name ?? "").trim();
    names.set(id, displayName || "User");
  }

  return names;
}

function normalizeSourceUrls(row: QuestionUpdateRow): string[] {
  const raw = Array.isArray(row.source_urls) ? row.source_urls : [];
  const merged = [...raw, row.source_url ?? ""];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of merged) {
    const value = String(item ?? "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
    if (out.length >= 8) break;
  }
  return out;
}

function mapUpdate(row: QuestionUpdateRow, nameMap: Map<string, string>): QuestionUpdate {
  const sourceUrls = normalizeSourceUrls(row);
  return {
    id: row.id,
    questionId: row.question_id,
    userId: row.user_id,
    authorName: nameMap.get(row.user_id) || "User",
    body: row.body,
    sourceUrl: sourceUrls[0] ?? null,
    sourceUrls,
    createdAt: row.created_at,
  };
}

export async function listQuestionUpdates(questionId: string, limit = 50): Promise<QuestionUpdate[]> {
  const supabase = getSupabaseAdminClient();
  const cappedLimit = Math.max(1, Math.min(200, Math.round(limit)));

  const { data, error } = await supabase
    .from("question_updates")
    .select("id,question_id,user_id,body,source_url,source_urls,created_at")
    .eq("question_id", questionId)
    .order("created_at", { ascending: false })
    .limit(cappedLimit);

  if (error) throw error;

  const rows = (data ?? []) as QuestionUpdateRow[];
  const nameMap = await loadDisplayNames(rows.map((r) => r.user_id));
  return rows.map((row) => mapUpdate(row, nameMap));
}

export async function addQuestionUpdate(input: {
  questionId: string;
  userId: string;
  body: string;
  sourceUrl: string | null;
  sourceUrls?: string[];
}): Promise<QuestionUpdate> {
  const supabase = getSupabaseAdminClient();
  const normalizedSourceUrls = Array.isArray(input.sourceUrls)
    ? input.sourceUrls
        .map((v) => String(v ?? "").trim())
        .filter(Boolean)
        .slice(0, 8)
    : input.sourceUrl
      ? [input.sourceUrl]
      : [];

  const { data, error } = await supabase
    .from("question_updates")
    .insert({
      question_id: input.questionId,
      user_id: input.userId,
      body: input.body,
      source_url: normalizedSourceUrls[0] ?? input.sourceUrl,
      source_urls: normalizedSourceUrls,
    })
    .select("id,question_id,user_id,body,source_url,source_urls,created_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Update konnte nicht gespeichert werden.");

  const row = data as QuestionUpdateRow;
  const names = await loadDisplayNames([row.user_id]);
  return mapUpdate(row, names);
}
