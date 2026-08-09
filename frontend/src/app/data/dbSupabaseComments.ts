import "server-only";

import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export type CommentStance = "yes" | "no" | "neutral";

export type QuestionComment = {
  id: string;
  questionId: string;
  userId: string;
  authorName: string;
  stance: CommentStance;
  body: string;
  sourceUrl: string | null;
  createdAt: string;
};

type CommentRow = {
  id: string;
  question_id: string;
  user_id: string;
  stance: string | null;
  body: string;
  source_url: string | null;
  created_at: string;
};

function normalizeStance(input: string | null | undefined): CommentStance {
  if (input === "yes" || input === "no" || input === "neutral") return input;
  return "neutral";
}

export async function listQuestionComments(questionId: string, limit = 50): Promise<QuestionComment[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("question_comments")
    .select("id,question_id,user_id,stance,body,source_url,created_at")
    .eq("question_id", questionId)
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(200, limit)));

  if (error) throw error;

  const rows = (data ?? []) as CommentRow[];
  const userIds = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));

  const displayNameByUserId = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: users, error: usersError } = await supabase
      .from("users")
      .select("id,display_name")
      .in("id", userIds);

    if (usersError) throw usersError;

    ((users ?? []) as Array<{ id: string | null; display_name: string | null }>).forEach((u) => {
      const id = String(u.id ?? "");
      const name = String(u.display_name ?? "").trim();
      if (id) displayNameByUserId.set(id, name || "User");
    });
  }

  return rows.map((row) => ({
    id: row.id,
    questionId: row.question_id,
    userId: row.user_id,
    authorName: displayNameByUserId.get(row.user_id) || "User",
    stance: normalizeStance(row.stance),
    body: row.body,
    sourceUrl: row.source_url ?? null,
    createdAt: row.created_at,
  }));
}

export async function addQuestionComment(input: {
  questionId: string;
  userId: string;
  stance: CommentStance;
  body: string;
  sourceUrl: string | null;
}): Promise<QuestionComment> {
  const supabase = getSupabaseAdminClient();
  const stance = input.stance === "yes" || input.stance === "no" ? input.stance : "neutral";

  const { data, error } = await supabase
    .from("question_comments")
    .insert({
      question_id: input.questionId,
      user_id: input.userId,
      stance,
      body: input.body,
      source_url: input.sourceUrl,
    })
    .select("id,question_id,user_id,stance,body,source_url,created_at")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Kommentar konnte nicht gespeichert werden.");

  const row = data as CommentRow;

  let authorName = "User";
  const { data: userRow, error: userError } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", row.user_id)
    .maybeSingle();
  if (userError) throw userError;
  authorName = String((userRow as { display_name: string | null } | null)?.display_name ?? "").trim() || "User";

  return {
    id: row.id,
    questionId: row.question_id,
    userId: row.user_id,
    authorName,
    stance: normalizeStance(row.stance),
    body: row.body,
    sourceUrl: row.source_url ?? null,
    createdAt: row.created_at,
  };
}
