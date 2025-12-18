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
  users?: { display_name?: string | null } | null;
};

function normalizeStance(input: string | null | undefined): CommentStance {
  if (input === "yes" || input === "no" || input === "neutral") return input;
  return "neutral";
}

export async function listQuestionComments(questionId: string, limit = 50): Promise<QuestionComment[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("question_comments")
    .select("id,question_id,user_id,stance,body,source_url,created_at,users(display_name)")
    .eq("question_id", questionId)
    .order("created_at", { ascending: true })
    .limit(Math.max(1, Math.min(200, limit)));

  if (error) throw error;

  return ((data ?? []) as CommentRow[]).map((row) => ({
    id: row.id,
    questionId: row.question_id,
    userId: row.user_id,
    authorName: row.users?.display_name?.trim() || "User",
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
    .select("id,question_id,user_id,stance,body,source_url,created_at,users(display_name)")
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("Kommentar konnte nicht gespeichert werden.");

  const row = data as CommentRow;
  return {
    id: row.id,
    questionId: row.question_id,
    userId: row.user_id,
    authorName: row.users?.display_name?.trim() || "User",
    stance: normalizeStance(row.stance),
    body: row.body,
    sourceUrl: row.source_url ?? null,
    createdAt: row.created_at,
  };
}

