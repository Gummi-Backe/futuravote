import "server-only";

import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

type FavoriteRow = {
  id: string;
  question_id: string;
  created_at: string | null;
};

type QuestionRow = {
  id: string;
  title: string;
  category: string | null;
  category_icon: string | null;
  category_color: string | null;
  region: string | null;
  closes_at: string | null;
  status: string | null;
  resolved_outcome: string | null;
  resolved_at: string | null;
};

export type FavoriteQuestion = {
  id: string;
  title: string;
  category: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  region: string | null;
  closesAt: string | null;
  status: string | null;
  resolvedOutcome: string | null;
  resolvedAt: string | null;
};

export async function listFavoriteQuestionIds(userId: string): Promise<string[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("question_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.warn("listFavoriteQuestionIds failed", error);
    return [];
  }

  return ((data ?? []) as { question_id?: string }[])
    .map((row) => (typeof row.question_id === "string" ? row.question_id : null))
    .filter((id): id is string => Boolean(id));
}

export async function addFavoriteQuestion(userId: string, questionId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase
    .from("favorites")
    .upsert({ user_id: userId, question_id: questionId }, { onConflict: "user_id,question_id" });
  if (error) throw error;
}

export async function removeFavoriteQuestion(userId: string, questionId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();
  const { error } = await supabase.from("favorites").delete().eq("user_id", userId).eq("question_id", questionId);
  if (error) throw error;
}

export async function toggleFavoriteQuestion(
  userId: string,
  questionId: string
): Promise<{ favorited: boolean }> {
  const supabase = getSupabaseAdminClient();

  const { data: existing, error: selectError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", userId)
    .eq("question_id", questionId)
    .limit(1);

  if (selectError) throw selectError;

  const existingId = (existing as { id?: string }[] | null)?.[0]?.id;
  if (existingId) {
    const { error: deleteError } = await supabase.from("favorites").delete().eq("id", existingId);
    if (deleteError) throw deleteError;
    return { favorited: false };
  }

  await addFavoriteQuestion(userId, questionId);
  return { favorited: true };
}

export async function listFavoriteQuestions(userId: string, limit = 20): Promise<FavoriteQuestion[]> {
  const supabase = getSupabaseAdminClient();

  const { data: favRows, error: favError } = await supabase
    .from("favorites")
    .select("question_id,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(50, limit)));

  if (favError) throw favError;

  const ids = ((favRows ?? []) as FavoriteRow[])
    .map((row) => row.question_id)
    .filter((id) => typeof id === "string" && id.length > 0);

  if (ids.length === 0) return [];

  const { data: questionRows, error: qError } = await supabase
    .from("questions")
    .select("id,title,category,category_icon,category_color,region,closes_at,status,resolved_outcome,resolved_at")
    .in("id", ids);

  if (qError) throw qError;

  const byId = new Map<string, QuestionRow>();
  for (const row of (questionRows ?? []) as QuestionRow[]) {
    if (row?.id) byId.set(row.id, row);
  }

  return ids
    .map((id) => byId.get(id))
    .filter((row): row is QuestionRow => Boolean(row))
    .map((row) => ({
      id: row.id,
      title: row.title,
      category: row.category ?? null,
      categoryIcon: row.category_icon ?? null,
      categoryColor: row.category_color ?? null,
      region: row.region ?? null,
      closesAt: row.closes_at ?? null,
      status: row.status ?? null,
      resolvedOutcome: row.resolved_outcome ?? null,
      resolvedAt: row.resolved_at ?? null,
    }));
}

