import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { categories, type Draft, type Question } from "./mock";
import { getSupabaseClient } from "@/app/lib/supabaseClient";

export type VoteChoice = "yes" | "no";
export type DraftReviewChoice = "good" | "bad";

export type QuestionWithVotes = Question & {
  yesVotes: number;
  noVotes: number;
  views: number;
  rankingScore: number;
  createdAt: string;
  userChoice?: VoteChoice;
};

type QuestionRow = {
  id: string;
  title: string;
  summary: string;
  description: string | null;
  region: string | null;
  image_url: string | null;
  image_credit: string | null;
  category: string;
  category_icon: string;
  category_color: string;
  closes_at: string;
  yes_votes: number;
  no_votes: number;
  views: number | null;
  status: string | null;
  ranking_score: number | null;
  created_at: string | null;
};

type VoteRow = {
  question_id: string;
  session_id: string;
  choice: VoteChoice;
};

type DraftRow = {
  id: string;
  title: string;
  description: string | null;
  region: string | null;
  image_url: string | null;
  image_credit: string | null;
  category: string;
  votes_for: number;
  votes_against: number;
  time_left_hours: number;
  target_closes_at: string | null;
  status: string | null;
  created_at: string | null;
};

const DATA_ROOT =
  process.env.DATA_DIR ?? (process.env.VERCEL ? "/tmp/futuravote" : path.join(process.cwd(), "data"));
const IMAGES_DIR = path.join(DATA_ROOT, "images");

function deleteImageFileIfPresent(imageUrl?: string | null) {
  if (!imageUrl) return;
  const lastSlash = imageUrl.lastIndexOf("/");
  const fileName = lastSlash >= 0 ? imageUrl.slice(lastSlash + 1) : imageUrl;
  if (!fileName) return;
  const filePath = path.join(IMAGES_DIR, fileName);
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Failed to delete image file", filePath, error);
  }
}

function computeRankingScore(row: QuestionRow): number {
  const votes = Math.max(0, (row.yes_votes ?? 0) + (row.no_votes ?? 0));
  const views = Math.max(0, row.views ?? 0);
  const engagementScore = Math.log(1 + votes);
  const voteRate = votes / Math.max(views, 1);
  const qualityScore = voteRate;

  let createdMs = row.created_at ? Date.parse(row.created_at) : NaN;
  if (!Number.isFinite(createdMs)) {
    createdMs = Date.now();
  }
  const ageHours = Math.max(0, (Date.now() - createdMs) / (1000 * 60 * 60));
  const freshnessScore = 1 / (1 + ageHours / 24);

  const creatorScore = 1.0;
  const base = 0.5 * engagementScore + 0.5 * qualityScore;
  let score = base * freshnessScore * creatorScore;
  if (ageHours < 12) {
    score += 1.0;
  }
  return score;
}

function mapQuestion(row: QuestionRow, sessionChoice?: VoteChoice): QuestionWithVotes {
  const yesVotes = row.yes_votes ?? 0;
  const noVotes = row.no_votes ?? 0;
  const total = Math.max(1, yesVotes + noVotes);
  const yesPct = Math.round((yesVotes / total) * 100);
  const noPct = 100 - yesPct;
  const createdAt = row.created_at ?? new Date().toISOString();
  const rankingScore = computeRankingScore(row);

  let status: Question["status"] | undefined;
  if (row.status === "archived") {
    status = "archived";
  } else {
    const closesMs = Date.parse(row.closes_at);
    if (Number.isFinite(closesMs)) {
      const daysLeft = (closesMs - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysLeft <= 14) {
        status = "closingSoon";
      }
    }
    if (!status && row.status && row.status !== "closingSoon") {
      status = row.status as Question["status"];
    }
  }

  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    description: row.description ?? undefined,
    region: row.region ?? undefined,
    imageUrl: row.image_url ?? undefined,
    imageCredit: row.image_credit ?? undefined,
    category: row.category,
    categoryIcon: row.category_icon,
    categoryColor: row.category_color,
    closesAt: row.closes_at,
    yesVotes,
    noVotes,
    yesPct,
    noPct,
    status,
    views: row.views ?? 0,
    rankingScore,
    createdAt,
    userChoice: sessionChoice,
  };
}

export async function getQuestionsFromSupabase(sessionId?: string): Promise<QuestionWithVotes[]> {
  const supabase = getSupabaseClient();

  const { data: rows, error } = await supabase
    .from("questions")
    .select("*")
    .not("status", "eq", "archived");

  if (error) {
    throw new Error(`Supabase getQuestions fehlgeschlagen: ${error.message}`);
  }
  if (!rows || rows.length === 0) {
    return [];
  }

  let sessionVotesMap = new Map<string, VoteChoice>();
  if (sessionId) {
    const { data: votes, error: voteError } = await supabase
      .from("votes")
      .select("question_id, session_id, choice")
      .eq("session_id", sessionId);

    if (voteError) {
      throw new Error(`Supabase getQuestions (Votes) fehlgeschlagen: ${voteError.message}`);
    }

    sessionVotesMap = new Map(
      (votes as VoteRow[]).map((v) => [v.question_id, v.choice])
    );
  }

  return (rows as QuestionRow[]).map((row) => mapQuestion(row, sessionVotesMap.get(row.id)));
}

export async function getQuestionByIdFromSupabase(
  id: string,
  sessionId?: string
): Promise<QuestionWithVotes | null> {
  const supabase = getSupabaseClient();

  const { data: row, error } = await supabase
    .from("questions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase getQuestionById fehlgeschlagen: ${error.message}`);
  }
  if (!row) return null;

  let sessionChoice: VoteChoice | undefined;
  if (sessionId) {
    const { data: voteRow, error: voteError } = await supabase
      .from("votes")
      .select("choice")
      .eq("question_id", id)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (voteError) {
      throw new Error(`Supabase getQuestionById (Vote) fehlgeschlagen: ${voteError.message}`);
    }
    if (voteRow && (voteRow as any).choice) {
      sessionChoice = (voteRow as any).choice as VoteChoice;
    }
  }

  return mapQuestion(row as QuestionRow, sessionChoice);
}

export async function voteOnQuestionInSupabase(
  id: string,
  choice: VoteChoice,
  sessionId: string
): Promise<QuestionWithVotes | null> {
  const supabase = getSupabaseClient();

  // Doppelvotes in derselben Session verhindern
  const { data: existingVote, error: existingError } = await supabase
    .from("votes")
    .select("choice")
    .eq("question_id", id)
    .eq("session_id", sessionId)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Supabase Vote-Check fehlgeschlagen: ${existingError.message}`);
  }
  if (existingVote) {
    return getQuestionByIdFromSupabase(id, sessionId);
  }

  const now = new Date().toISOString();

  const { error: insertError } = await supabase.from("votes").insert({
    question_id: id,
    session_id: sessionId,
    choice,
    created_at: now,
  });

  if (insertError) {
    throw new Error(`Supabase Vote-Insert fehlgeschlagen: ${insertError.message}`);
  }

  // Aktuelle Zaehler laden und explizit hochzaehlen
  const { data: countsRow, error: countsError } = await supabase
    .from("questions")
    .select("yes_votes, no_votes")
    .eq("id", id)
    .maybeSingle();

  if (countsError) {
    throw new Error(`Supabase Vote-Update (Select) fehlgeschlagen: ${countsError.message}`);
  }
  if (!countsRow) {
    return null;
  }

  const currentYes = (countsRow as any).yes_votes ?? 0;
  const currentNo = (countsRow as any).no_votes ?? 0;
  const nextYes = choice === "yes" ? currentYes + 1 : currentYes;
  const nextNo = choice === "no" ? currentNo + 1 : currentNo;

  const { error: updateError } = await supabase
    .from("questions")
    .update({ yes_votes: nextYes, no_votes: nextNo })
    .eq("id", id);

  if (updateError) {
    throw new Error(`Supabase Vote-Update fehlgeschlagen: ${updateError.message}`);
  }

  return getQuestionByIdFromSupabase(id, sessionId);
}

export async function incrementViewsForAllInSupabase(): Promise<void> {
  const supabase = getSupabaseClient();

  const { data: rows, error } = await supabase.from("questions").select("id, views");
  if (error) {
    throw new Error(`Supabase Views-Select fehlgeschlagen: ${error.message}`);
  }
  if (!rows || rows.length === 0) return;

  for (const row of rows as { id: string; views: number | null }[]) {
    const nextViews = (row.views ?? 0) + 1;
    const { error: updateError } = await supabase
      .from("questions")
      .update({ views: nextViews })
      .eq("id", row.id);
    if (updateError) {
      throw new Error(`Supabase Views-Update fehlgeschlagen: ${updateError.message}`);
    }
  }
}

// --- Drafts / Review / Admin (Supabase) ------------------------------------

function mapDraftRow(row: DraftRow): Draft {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    region: row.region ?? undefined,
    imageUrl: row.image_url ?? undefined,
    imageCredit: row.image_credit ?? undefined,
    category: row.category,
    votesFor: row.votes_for ?? 0,
    votesAgainst: row.votes_against ?? 0,
    timeLeftHours: row.time_left_hours ?? 72,
    status: (row.status ?? "open") as Draft["status"],
  };
}

export async function getDraftsFromSupabase(): Promise<Draft[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("drafts")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Supabase getDrafts fehlgeschlagen: ${error.message}`);
  }
  if (!data) return [];
  return (data as DraftRow[]).map(mapDraftRow);
}

export async function createDraftInSupabase(input: {
  title: string;
  category: string;
  description?: string;
  region?: string;
  imageUrl?: string;
  imageCredit?: string;
  timeLeftHours?: number;
  targetClosesAt?: string;
}): Promise<Draft> {
  const supabase = getSupabaseClient();
  const id = randomUUID();
  const timeLeft =
    typeof input.timeLeftHours === "number" && Number.isFinite(input.timeLeftHours) && input.timeLeftHours > 0
      ? Math.round(input.timeLeftHours)
      : 72;

  const { data, error } = await supabase
    .from("drafts")
    .insert({
      id,
      title: input.title,
      description: input.description ?? null,
      region: input.region ?? null,
      image_url: input.imageUrl ?? null,
      image_credit: input.imageCredit ?? null,
      category: input.category,
      votes_for: 0,
      votes_against: 0,
      time_left_hours: timeLeft,
      target_closes_at: input.targetClosesAt ?? null,
      status: "open",
    })
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase createDraft fehlgeschlagen: ${error.message}`);
  }
  if (!data) {
    throw new Error("Supabase createDraft hat kein Row-Objekt zurueckgegeben.");
  }

  return mapDraftRow(data as DraftRow);
}

async function maybePromoteDraftInSupabase(row: DraftRow): Promise<void> {
  const supabase = getSupabaseClient();

  const status = row.status ?? "open";
  if (status !== "open") return;

  const votesFor = row.votes_for ?? 0;
  const votesAgainst = row.votes_against ?? 0;
  const total = votesFor + votesAgainst;
  if (total < 5) return;

  if (votesFor >= votesAgainst + 2) {
    const cat = categories.find((c) => c.label === row.category) ?? categories[0];
    let closesDate: Date;
    if (row.target_closes_at) {
      const parsed = Date.parse(row.target_closes_at);
      closesDate = Number.isFinite(parsed) ? new Date(parsed) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    } else {
      closesDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    }
    const closesAt = closesDate.toISOString().split("T")[0];
    const questionId = row.id.startsWith("q_") ? row.id : `q_${row.id}`;
    const summary = row.region ? `${row.category} · ${row.region}` : row.category;

    const { error: upsertError } = await supabase
      .from("questions")
      .upsert(
        {
          id: questionId,
          title: row.title,
          summary,
          description: row.description ?? null,
          region: row.region ?? null,
          image_url: row.image_url ?? null,
          image_credit: row.image_credit ?? null,
          category: row.category,
          category_icon: cat?.icon ?? "?",
          category_color: cat?.color ?? "#22c55e",
          closes_at: closesAt,
          yes_votes: 0,
          no_votes: 0,
          views: 0,
          status: "new",
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      throw new Error(`Supabase maybePromoteDraft (upsert question) fehlgeschlagen: ${upsertError.message}`);
    }

    const { error: updateDraftError } = await supabase
      .from("drafts")
      .update({ status: "accepted" })
      .eq("id", row.id);
    if (updateDraftError) {
      throw new Error(`Supabase maybePromoteDraft (update draft) fehlgeschlagen: ${updateDraftError.message}`);
    }
  } else if (votesAgainst >= votesFor + 2) {
    const { error: updateDraftError } = await supabase
      .from("drafts")
      .update({ status: "rejected" })
      .eq("id", row.id);
    if (updateDraftError) {
      throw new Error(`Supabase maybePromoteDraft (reject draft) fehlgeschlagen: ${updateDraftError.message}`);
    }
  }
}

export async function voteOnDraftInSupabase(id: string, choice: DraftReviewChoice): Promise<Draft | null> {
  const supabase = getSupabaseClient();

  const { data: row, error } = await supabase.from("drafts").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(`Supabase voteOnDraft (select) fehlgeschlagen: ${error.message}`);
  }
  if (!row) return null;

  const draftRow = row as DraftRow;
  const nextVotesFor = choice === "good" ? (draftRow.votes_for ?? 0) + 1 : draftRow.votes_for ?? 0;
  const nextVotesAgainst = choice === "bad" ? (draftRow.votes_against ?? 0) + 1 : draftRow.votes_against ?? 0;

  const { data: updatedRow, error: updateError } = await supabase
    .from("drafts")
    .update({
      votes_for: nextVotesFor,
      votes_against: nextVotesAgainst,
    })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (updateError) {
    throw new Error(`Supabase voteOnDraft (update) fehlgeschlagen: ${updateError.message}`);
  }
  const effectiveRow = (updatedRow ?? draftRow) as DraftRow;

  await maybePromoteDraftInSupabase(effectiveRow);

  return mapDraftRow(effectiveRow);
}

export async function adminAcceptDraftInSupabase(id: string): Promise<Draft | null> {
  const supabase = getSupabaseClient();
  const { data: row, error } = await supabase.from("drafts").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(`Supabase adminAcceptDraft (select) fehlgeschlagen: ${error.message}`);
  }
  if (!row) return null;

  const draftRow = row as DraftRow;
  if ((draftRow.status ?? "open") !== "accepted") {
    // Admin-Promotion ohne Vote-Schwellen
    const cat = categories.find((c) => c.label === draftRow.category) ?? categories[0];
    let closesDate: Date;
    if (draftRow.target_closes_at) {
      const parsed = Date.parse(draftRow.target_closes_at);
      closesDate = Number.isFinite(parsed) ? new Date(parsed) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    } else {
      closesDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    }
    const closesAt = closesDate.toISOString().split("T")[0];
    const questionId = draftRow.id.startsWith("q_") ? draftRow.id : `q_${draftRow.id}`;
    const summary = draftRow.region ? `${draftRow.category} · ${draftRow.region}` : draftRow.category;

    const { error: upsertError } = await supabase
      .from("questions")
      .upsert(
        {
          id: questionId,
          title: draftRow.title,
          summary,
          description: draftRow.description ?? null,
          region: draftRow.region ?? null,
          image_url: draftRow.image_url ?? null,
          image_credit: draftRow.image_credit ?? null,
          category: draftRow.category,
          category_icon: cat?.icon ?? "?",
          category_color: cat?.color ?? "#22c55e",
          closes_at: closesAt,
          yes_votes: 0,
          no_votes: 0,
          views: 0,
          status: "new",
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      throw new Error(`Supabase adminAcceptDraft (upsert question) fehlgeschlagen: ${upsertError.message}`);
    }

    const { data: acceptedRow, error: updateDraftError } = await supabase
      .from("drafts")
      .update({ status: "accepted" })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (updateDraftError) {
      throw new Error(`Supabase adminAcceptDraft (update draft) fehlgeschlagen: ${updateDraftError.message}`);
    }

    return mapDraftRow((acceptedRow ?? draftRow) as DraftRow);
  }

  return mapDraftRow(draftRow);
}

export async function adminRejectDraftInSupabase(id: string): Promise<Draft | null> {
  const supabase = getSupabaseClient();
  const { data: row, error } = await supabase.from("drafts").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(`Supabase adminRejectDraft (select) fehlgeschlagen: ${error.message}`);
  }
  if (!row) return null;

  const draftRow = row as DraftRow;
  if ((draftRow.status ?? "open") !== "rejected") {
    const { data: updatedRow, error: updateError } = await supabase
      .from("drafts")
      .update({ status: "rejected" })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (updateError) {
      throw new Error(`Supabase adminRejectDraft (update) fehlgeschlagen: ${updateError.message}`);
    }

    return mapDraftRow((updatedRow ?? draftRow) as DraftRow);
  }

  return mapDraftRow(draftRow);
}

export async function adminDeleteDraftInSupabase(id: string): Promise<Draft | null> {
  const supabase = getSupabaseClient();
  const { data: row, error } = await supabase.from("drafts").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(`Supabase adminDeleteDraft (select) fehlgeschlagen: ${error.message}`);
  }
  if (!row) return null;

  const draftRow = row as DraftRow;
  deleteImageFileIfPresent(draftRow.image_url);

  const { error: deleteError } = await supabase.from("drafts").delete().eq("id", id);
  if (deleteError) {
    throw new Error(`Supabase adminDeleteDraft (delete) fehlgeschlagen: ${deleteError.message}`);
  }

  return mapDraftRow(draftRow);
}

export async function adminArchiveQuestionInSupabase(id: string): Promise<QuestionWithVotes | null> {
  const supabase = getSupabaseClient();
  const { data: existingRow, error: selectError } = await supabase
    .from("questions")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (selectError) {
    throw new Error(`Supabase adminArchiveQuestion (select) fehlgeschlagen: ${selectError.message}`);
  }
  if (!existingRow) return null;

  const { data: updatedRow, error: updateError } = await supabase
    .from("questions")
    .update({ status: "archived" })
    .eq("id", id)
    .select("*")
    .maybeSingle();

  if (updateError) {
    throw new Error(`Supabase adminArchiveQuestion (update) fehlgeschlagen: ${updateError.message}`);
  }

  return mapQuestion((updatedRow ?? existingRow) as QuestionRow);
}

export async function adminDeleteQuestionInSupabase(id: string): Promise<QuestionWithVotes | null> {
  const supabase = getSupabaseClient();
  const { data: row, error } = await supabase.from("questions").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(`Supabase adminDeleteQuestion (select) fehlgeschlagen: ${error.message}`);
  }
  if (!row) return null;

  const questionRow = row as QuestionRow;
  deleteImageFileIfPresent(questionRow.image_url);

  const { error: deleteError } = await supabase.from("questions").delete().eq("id", id);
  if (deleteError) {
    throw new Error(`Supabase adminDeleteQuestion (delete) fehlgeschlagen: ${deleteError.message}`);
  }

  return mapQuestion(questionRow);
}
