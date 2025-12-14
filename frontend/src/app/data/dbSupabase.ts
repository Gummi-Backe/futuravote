import "server-only";

import { randomBytes, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { categories, type Draft, type PollVisibility, type Question } from "./mock";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getSupabaseServerClient } from "@/app/lib/supabaseServerClient";

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

export type QuestionWithUserVote = QuestionWithVotes & {
  votedAt: string;
};

type QuestionRow = {
  id: string;
  creator_id: string | null;
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
  visibility: PollVisibility | null;
  share_id: string | null;
};

type QuestionsRankCursor = {
  v: 1;
  kind: "questions_rank";
  rankingScore: number;
  createdAt: string;
  id: string;
};

type QuestionsNewCursor = {
  v: 1;
  kind: "questions_new";
  createdAt: string;
  id: string;
};

type QuestionsClosingCursor = {
  v: 1;
  kind: "questions_closing";
  closesAt: string;
  id: string;
};

type DraftsCursor = {
  v: 1;
  kind: "drafts";
  createdAt: string;
  id: string;
};

type CursorPayload = QuestionsRankCursor | QuestionsNewCursor | QuestionsClosingCursor | DraftsCursor;

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((input.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function encodeCursor(payload: CursorPayload): string {
  return toBase64Url(JSON.stringify(payload));
}

function decodeCursor(raw?: string | null): CursorPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(raw)) as Partial<CursorPayload>;
    if (parsed?.v != 1) return null;
    if (typeof (parsed as any).kind !== "string") return null;
    return parsed as CursorPayload;
  } catch {
    return null;
  }
}

function normalizeTimestamp(value: string | null | undefined): string {
  if (!value) return new Date(0).toISOString();
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return new Date(0).toISOString();
  return new Date(parsed).toISOString();
}

function generateShareId(): string {
  // Nicht erratbar + URL-sicher (base64url ohne Padding)
  return randomBytes(18)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


type VoteRow = {
  question_id: string;
  session_id: string;
  choice: VoteChoice;
  created_at?: string;
};

type DraftRow = {
  id: string;
  creator_id: string | null;
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
  visibility: PollVisibility | null;
  share_id: string | null;
};

const IMAGE_BUCKET = process.env.SUPABASE_IMAGE_BUCKET || "question-images";
const DATA_ROOT =
  process.env.DATA_DIR ?? (process.env.VERCEL ? "/tmp/futuravote" : path.join(process.cwd(), "data"));
const IMAGES_DIR = path.join(DATA_ROOT, "images");

function deleteImageFileIfPresent(imageUrl?: string | null) {
  if (!imageUrl) return;

  try {
    // Supabase-Public-URL? (neuer Weg)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl && imageUrl.startsWith(supabaseUrl)) {
      try {
        const url = new URL(imageUrl);
        const publicPrefix = "/storage/v1/object/public/";
        const idx = url.pathname.indexOf(publicPrefix);
        if (idx >= 0) {
          const pathPart = url.pathname.slice(idx + publicPrefix.length);
          const [bucket, ...rest] = pathPart.split("/");
          const pathInBucket = rest.join("/");
          if (bucket === IMAGE_BUCKET && pathInBucket) {
            const supabase = getSupabaseServerClient();
            supabase.storage
              .from(IMAGE_BUCKET)
              .remove([pathInBucket])
              .catch((err) => {
                console.error("Failed to delete image from Supabase Storage", err);
              });
            return;
          }
        }
      } catch (parseError) {
        console.error("Failed to parse Supabase image URL for deletion", parseError);
      }
    }

    // Legacy: lokale Bilddatei loeschen (z.B. bei altem SQLite-Setup)
    const lastSlash = imageUrl.lastIndexOf("/");
    const fileName = lastSlash >= 0 ? imageUrl.slice(lastSlash + 1) : imageUrl;
    if (!fileName) return;
    const filePath = path.join(IMAGES_DIR, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Failed to delete image file", imageUrl, error);
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
    creatorId: row.creator_id ?? undefined,
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
    visibility: (row.visibility ?? "public") as PollVisibility,
    shareId: row.share_id ?? undefined,
  };
}

export async function getQuestionsFromSupabase(sessionId?: string): Promise<QuestionWithVotes[]> {
  const supabase = getSupabaseAdminClient();

  const { data: rows, error } = await supabase
    .from("questions")
    .select("*")
    .eq("visibility", "public")
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

export async function getQuestionsVotedByUserFromSupabase(options: {
  userId: string;
  choice?: VoteChoice | "all";
  limit?: number;
}): Promise<QuestionWithUserVote[]> {
  const { userId, choice = "all", limit } = options;
  const supabase = getSupabaseAdminClient();

  // Votes des Nutzers laden
  let votesQuery = supabase
    .from("votes")
    .select("question_id, choice, created_at")
    .eq("user_id", userId);

  if (choice !== "all") {
    votesQuery = votesQuery.eq("choice", choice);
  }

  votesQuery = votesQuery.order("created_at", { ascending: false });
  if (typeof limit === "number" && limit > 0) {
    votesQuery = votesQuery.limit(limit);
  }

  const { data: voteRows, error: votesError } = await votesQuery;
  if (votesError) {
    throw new Error(`Supabase getQuestionsVotedByUser (Votes) fehlgeschlagen: ${votesError.message}`);
  }
  if (!voteRows || voteRows.length === 0) {
    return [];
  }

  // Falls derselbe Nutzer ueber mehrere Sessions auf dieselbe Frage gestimmt hat,
  // nehmen wir nur die juengste Stimme pro Frage.
  const perQuestion = new Map<
    string,
    {
      question_id: string;
      choice: VoteChoice;
      created_at: string;
    }
  >();

  for (const v of voteRows as VoteRow[]) {
    const createdAt = (v.created_at as string | undefined) ?? new Date().toISOString();
    const existing = perQuestion.get(v.question_id);
    if (!existing || createdAt > existing.created_at) {
      perQuestion.set(v.question_id, {
        question_id: v.question_id,
        choice: v.choice,
        created_at: createdAt,
      });
    }
  }

  const uniqueVotes = Array.from(perQuestion.values()).sort((a, b) =>
    a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0
  );

  const questionIds = uniqueVotes.map((v) => v.question_id);

  const { data: questionRows, error: questionsError } = await supabase
    .from("questions")
    .select("*")
    .in("id", questionIds);

  if (questionsError) {
    throw new Error(
      `Supabase getQuestionsVotedByUser (Questions) fehlgeschlagen: ${questionsError.message}`
    );
  }
  if (!questionRows || questionRows.length === 0) {
    return [];
  }

  const byId = new Map<string, QuestionRow>();
  for (const row of questionRows as QuestionRow[]) {
    byId.set(row.id, row);
  }

  const result: QuestionWithUserVote[] = [];
  for (const vote of uniqueVotes) {
    const row = byId.get(vote.question_id);
    if (!row) continue;
    const mapped = mapQuestion(row, vote.choice);
    result.push({
      ...mapped,
      votedAt: vote.created_at,
    });
  }

  return result;
}

export async function getQuestionsPageFromSupabase(options: {
  sessionId?: string;
  limit: number;
  offset: number;
  cursor?: string | null;
  tab?: string;
  category?: string | null;
  region?: string | null;
}): Promise<{ items: QuestionWithVotes[]; total: number; nextCursor: string | null }> {
  const { sessionId, limit, offset, cursor, tab, category, region } = options;
  const supabase = getSupabaseAdminClient();
  const cursorMode = Boolean(cursor);

  const now = new Date();

  // Votes der aktuellen Session einmalig laden (fuer userChoice und ggf. "unanswered")
  let sessionVotesMap = new Map<string, VoteChoice>();
  let votedQuestionIds: string[] = [];
  if (sessionId) {
    const { data: votes, error: voteError } = await supabase
      .from("votes")
      .select("question_id, session_id, choice")
      .eq("session_id", sessionId);

    if (voteError) {
      throw new Error(`Supabase getQuestionsPage (Votes) fehlgeschlagen: ${voteError.message}`);
    }

    const voteRows = (votes as VoteRow[]) ?? [];
    sessionVotesMap = new Map(voteRows.map((v) => [v.question_id, v.choice]));

    if (tab === "unanswered") {
      votedQuestionIds = voteRows.map((v) => v.question_id);
    }
  }

  const applyFilters = (query: any) => {
    query = query.not("status", "eq", "archived");
    query = query.eq("visibility", "public");

    if (category) {
      query = query.eq("category", category);
    }

    if (region) {
      if (region === "Global") {
        query = query.or("region.is.null,region.eq.Global");
      } else {
        query = query.eq("region", region);
      }
    }

    if (tab === "trending") {
      // Trending: Fragen der letzten 3 Tage, sortiert nach Ranking
      const minCreatedAt = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", minCreatedAt);
    } else if (tab === "new") {
      // Neu & wenig bewertet: Fragen der letzten 14 Tage mit wenigen Stimmen
      const minCreatedAt = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
      query = query
        .gte("created_at", minCreatedAt)
        .lte("yes_votes", 5)
        .lte("no_votes", 5);
    } else if (tab === "top") {
      // Top heute: Fragen der letzten 24 Stunden, nach Ranking sortiert
      const minCreatedAt = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
      query = query.gte("created_at", minCreatedAt);
    } else if (tab === "closingSoon") {
      // Fragen, deren Abstimmung in den naechsten 14 Tagen endet
      const todayIso = now.toISOString().split("T")[0];
      const maxDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];
      query = query.gte("closes_at", todayIso).lte("closes_at", maxDate);
    }

    // "Noch nicht abgestimmt": nur Fragen ohne Vote in dieser Session
    if (tab === "unanswered" && votedQuestionIds.length > 0) {
      const inList = `(${votedQuestionIds.map((id) => `"${id}"`).join(",")})`;
      query = query.not("id", "in", inList);
    }

    return query;
  };

  let totalCount: number | null = null;
  if (cursorMode) {
    const countQuery = applyFilters(supabase.from("questions").select("id", { count: "exact", head: true }));
    const { error: countError, count } = await countQuery;
    if (countError) {
      throw new Error(`Supabase getQuestionsPage (Count) fehlgeschlagen: ${countError.message}`);
    }
    totalCount = count ?? 0;
  }

  let query = cursorMode
    ? supabase.from("questions").select("*")
    : supabase.from("questions").select("*", { count: "exact" });

  query = applyFilters(query);

  const decoded = decodeCursor(cursor);

  if (tab === "closingSoon") {
    query = query.order("closes_at", { ascending: true }).order("id", { ascending: true });

    if (decoded?.kind === "questions_closing") {
      query = query.or(
        `closes_at.gt.${decoded.closesAt},and(closes_at.eq.${decoded.closesAt},id.gt.${decoded.id})`
      );
    }
  } else if (tab === "new") {
    query = query.order("created_at", { ascending: false }).order("id", { ascending: false });

    if (decoded?.kind === "questions_new") {
      const createdAt = normalizeTimestamp(decoded.createdAt);
      query = query.or(
        `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${decoded.id})`
      );
    }
  } else {
    query = query
      .order("ranking_score", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (decoded?.kind === "questions_rank") {
      const createdAt = normalizeTimestamp(decoded.createdAt);
      query = query.or(
        `ranking_score.lt.${decoded.rankingScore},and(ranking_score.eq.${decoded.rankingScore},created_at.lt.${createdAt}),and(ranking_score.eq.${decoded.rankingScore},created_at.eq.${createdAt},id.lt.${decoded.id})`
      );
    }
  }

  if (cursorMode) {
    query = query.limit(limit + 1);
  } else {
    query = query.range(offset, offset + limit - 1);
  }

  const { data: rows, error, count } = await query;
  if (error) {
    throw new Error(`Supabase getQuestionsPage fehlgeschlagen: ${error.message}`);
  }

  const typedRows = (rows as QuestionRow[]) ?? [];
  if (typedRows.length === 0) {
    return { items: [], total: cursorMode ? totalCount ?? 0 : count ?? 0, nextCursor: null };
  }

  const total = cursorMode ? totalCount ?? typedRows.length : count ?? typedRows.length;
  const hasMore = cursorMode ? typedRows.length > limit : offset + typedRows.length < total;
  const pageRows = cursorMode && typedRows.length > limit ? typedRows.slice(0, limit) : typedRows;

  const items = pageRows.map((row) => mapQuestion(row, sessionVotesMap.get(row.id)));

  const lastRow = pageRows[pageRows.length - 1];
  let nextCursor: string | null = null;
  if (lastRow && hasMore) {
    if (tab === "closingSoon") {
      nextCursor = encodeCursor({
        v: 1,
        kind: "questions_closing",
        closesAt: lastRow.closes_at,
        id: lastRow.id,
      });
    } else if (tab === "new") {
      nextCursor = encodeCursor({
        v: 1,
        kind: "questions_new",
        createdAt: normalizeTimestamp(lastRow.created_at),
        id: lastRow.id,
      });
    } else {
      nextCursor = encodeCursor({
        v: 1,
        kind: "questions_rank",
        rankingScore: Number(lastRow.ranking_score ?? 0),
        createdAt: normalizeTimestamp(lastRow.created_at),
        id: lastRow.id,
      });
    }
  }

  return { items, total, nextCursor };
}
export async function getQuestionByIdFromSupabase(
  id: string,
  sessionId?: string
): Promise<QuestionWithVotes | null> {
  const supabase = getSupabaseAdminClient();

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

export type SharedPoll =
  | { kind: "question"; question: QuestionWithVotes; shareId: string }
  | { kind: "draft"; draft: Draft; shareId: string; alreadyReviewed: boolean };

export async function getPollByShareIdFromSupabase(options: {
  shareId: string;
  sessionId?: string;
}): Promise<SharedPoll | null> {
  const { shareId, sessionId } = options;
  const supabase = getSupabaseAdminClient();

  const { data: questionRow, error: questionError } = await supabase
    .from("questions")
    .select("*")
    .eq("share_id", shareId)
    .maybeSingle();

  if (questionError) {
    throw new Error(`Supabase getPollByShareId (question) fehlgeschlagen: ${questionError.message}`);
  }

  if (questionRow) {
    let sessionChoice: VoteChoice | undefined;
    if (sessionId) {
      const { data: voteRow, error: voteError } = await supabase
        .from("votes")
        .select("choice")
        .eq("question_id", (questionRow as any).id)
        .eq("session_id", sessionId)
        .maybeSingle();

      if (voteError) {
        throw new Error(`Supabase getPollByShareId (vote) fehlgeschlagen: ${voteError.message}`);
      }
      if (voteRow && (voteRow as any).choice) {
        sessionChoice = (voteRow as any).choice as VoteChoice;
      }
    }

    return {
      kind: "question",
      question: mapQuestion(questionRow as QuestionRow, sessionChoice),
      shareId,
    };
  }

  const { data: draftRow, error: draftError } = await supabase
    .from("drafts")
    .select("*")
    .eq("share_id", shareId)
    .maybeSingle();

  if (draftError) {
    throw new Error(`Supabase getPollByShareId (draft) fehlgeschlagen: ${draftError.message}`);
  }
  if (!draftRow) return null;

  const draftTyped = draftRow as DraftRow;
  if ((draftTyped.visibility ?? "public") === "link_only" && (draftTyped.share_id ?? null)) {
    const cat = categories.find((c) => c.label === draftTyped.category) ?? categories[0];

    let closesDate: Date;
    if (draftTyped.target_closes_at) {
      const parsed = Date.parse(draftTyped.target_closes_at);
      closesDate = Number.isFinite(parsed) ? new Date(parsed) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    } else {
      closesDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
    }
    const closesAt = closesDate.toISOString().split("T")[0];
    const questionId = draftTyped.id.startsWith("q_") ? draftTyped.id : `q_${draftTyped.id}`;
    const summary = draftTyped.region ? `${draftTyped.category} · ${draftTyped.region}` : draftTyped.category;

    const { error: upsertError } = await supabase
      .from("questions")
      .upsert(
        {
          id: questionId,
          creator_id: draftTyped.creator_id ?? null,
          title: draftTyped.title,
          summary,
          description: draftTyped.description ?? null,
          region: draftTyped.region ?? null,
          image_url: draftTyped.image_url ?? null,
          image_credit: draftTyped.image_credit ?? null,
          category: draftTyped.category,
          category_icon: cat?.icon ?? "?",
          category_color: cat?.color ?? "#22c55e",
          closes_at: closesAt,
          yes_votes: 0,
          no_votes: 0,
          views: 0,
          status: "new",
          visibility: "link_only",
          share_id: draftTyped.share_id ?? null,
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      throw new Error(`Supabase getPollByShareId (promote draft) fehlgeschlagen: ${upsertError.message}`);
    }

    const question = await getQuestionByIdFromSupabase(questionId, sessionId);
    if (!question) return null;
    return { kind: "question", question, shareId };
  }

  let alreadyReviewed = false;
  if (sessionId) {
    const { data: reviewRow, error: reviewError } = await supabase
      .from("draft_reviews")
      .select("id")
      .eq("draft_id", (draftRow as any).id)
      .eq("session_id", sessionId)
      .maybeSingle();

    if (reviewError) {
      const code = (reviewError as any).code as string | undefined;
      if (code !== "42P01") {
        throw new Error(`Supabase getPollByShareId (draft review) fehlgeschlagen: ${reviewError.message}`);
      }
    } else if (reviewRow) {
      alreadyReviewed = true;
    }
  }

  return { kind: "draft", draft: mapDraftRow(draftTyped), shareId, alreadyReviewed };
}

export async function voteOnQuestionInSupabase(
  id: string,
  choice: VoteChoice,
  sessionId: string,
  userId?: string | null
): Promise<QuestionWithVotes | null> {
  const supabase = getSupabaseAdminClient();

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
    user_id: userId ?? null,
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
  const supabase = getSupabaseAdminClient();

  const { data: rows, error } = await supabase.from("questions").select("id, views").eq("visibility", "public");
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
  // Ursprüngliche Review-Dauer in Stunden
  let timeLeft = row.time_left_hours ?? 72;

  // Wenn ein Erstellungszeitpunkt vorhanden ist, berechnen wir die verbleibende Zeit
  if (row.created_at) {
    const createdMs = Date.parse(row.created_at);
    if (Number.isFinite(createdMs)) {
      const diffHours = (Date.now() - createdMs) / (1000 * 60 * 60);
      timeLeft = Math.max(0, timeLeft - diffHours);
    }
  }

  const roundedTimeLeft = Math.max(0, Math.round(timeLeft));

  return {
    id: row.id,
    creatorId: row.creator_id ?? undefined,
    title: row.title,
    description: row.description ?? undefined,
    region: row.region ?? undefined,
    imageUrl: row.image_url ?? undefined,
    imageCredit: row.image_credit ?? undefined,
    category: row.category,
    votesFor: row.votes_for ?? 0,
    votesAgainst: row.votes_against ?? 0,
    timeLeftHours: roundedTimeLeft,
    status: (row.status ?? "open") as Draft["status"],
    visibility: (row.visibility ?? "public") as PollVisibility,
    shareId: row.share_id ?? undefined,
  };
}

export async function getDraftsFromSupabase(): Promise<Draft[]> {
  const supabase = getSupabaseAdminClient();
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

export async function getDraftsForCreatorFromSupabase(options: {
  creatorId: string;
  status?: "all" | "open" | "accepted" | "rejected";
}): Promise<Draft[]> {
  const { creatorId, status } = options;
  const supabase = getSupabaseAdminClient();

  let query = supabase.from("drafts").select("*").eq("creator_id", creatorId);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  query = query.order("created_at", { ascending: false });

  const { data, error } = await query;
  if (error) {
    throw new Error(`Supabase getDraftsForCreator fehlgeschlagen: ${error.message}`);
  }
  if (!data) return [];
  return (data as DraftRow[]).map(mapDraftRow);
}

export async function getDraftsPageFromSupabase(options: {
  limit: number;
  offset: number;
  cursor?: string | null;
  category?: string | null;
  region?: string | null;
  status?: "all" | "open" | "accepted" | "rejected";
}): Promise<{ items: Draft[]; total: number; nextCursor: string | null }> {
  const { limit, offset, cursor, category, region, status } = options;
  const supabase = getSupabaseAdminClient();
  const cursorMode = Boolean(cursor);

  const applyFilters = (query: any) => {
    query = query.eq("visibility", "public");
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    if (category) {
      query = query.eq("category", category);
    }

    if (region) {
      if (region === "Global") {
        query = query.or("region.is.null,region.eq.Global");
      } else {
        query = query.eq("region", region);
      }
    }

    return query;
  };

  let totalCount: number | null = null;
  if (cursorMode) {
    const countQuery = applyFilters(supabase.from("drafts").select("id", { count: "exact", head: true }));
    const { error: countError, count } = await countQuery;
    if (countError) {
      throw new Error(`Supabase getDraftsPage (Count) fehlgeschlagen: ${countError.message}`);
    }
    totalCount = count ?? 0;
  }

  let query = cursorMode ? supabase.from("drafts").select("*") : supabase.from("drafts").select("*", { count: "exact" });
  query = applyFilters(query);

  query = query.order("created_at", { ascending: false }).order("id", { ascending: false });

  const decoded = decodeCursor(cursor);
  if (decoded?.kind == "drafts") {
    const createdAt = normalizeTimestamp(decoded.createdAt);
    query = query.or(
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${decoded.id})`
    );
  }

  if (cursorMode) {
    query = query.limit(limit + 1);
  } else {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error, count } = await query;
  if (error) {
    throw new Error(`Supabase getDraftsPage fehlgeschlagen: ${error.message}`);
  }

  const rows = (data as DraftRow[]) ?? [];
  if (rows.length === 0) {
    return { items: [], total: cursorMode ? totalCount ?? 0 : count ?? 0, nextCursor: null };
  }

  const total = cursorMode ? totalCount ?? rows.length : count ?? rows.length;
  const hasMore = cursorMode ? rows.length > limit : offset + rows.length < total;
  const pageRows = cursorMode && rows.length > limit ? rows.slice(0, limit) : rows;
  const items = pageRows.map(mapDraftRow);

  const lastRow = pageRows[pageRows.length - 1];
  const nextCursor =
    lastRow && hasMore
      ? encodeCursor({
          v: 1,
          kind: "drafts",
          createdAt: normalizeTimestamp(lastRow.created_at),
          id: lastRow.id,
        })
      : null;

  return { items, total, nextCursor };
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
  creatorId?: string;
  visibility?: PollVisibility;
}): Promise<Draft> {
  const supabase = getSupabaseAdminClient();
  const id = randomUUID();
  const visibility: PollVisibility = input.visibility === "link_only" ? "link_only" : "public";
  const shareId = visibility === "link_only" ? generateShareId() : null;
  const timeLeft =
    typeof input.timeLeftHours === "number" && Number.isFinite(input.timeLeftHours) && input.timeLeftHours > 0
      ? Math.round(input.timeLeftHours)
      : 72;

  const { data, error } = await supabase
    .from("drafts")
    .insert({
      id,
      creator_id: input.creatorId ?? null,
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
      visibility,
      share_id: shareId,
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

export async function createLinkOnlyQuestionInSupabase(input: {
  title: string;
  category: string;
  description?: string;
  region?: string;
  imageUrl?: string;
  imageCredit?: string;
  timeLeftHours?: number;
  targetClosesAt?: string;
  creatorId?: string;
}): Promise<QuestionWithVotes> {
  const supabase = getSupabaseAdminClient();

  const cat = categories.find((c) => c.label === input.category) ?? categories[0];
  const id = `q_${randomUUID()}`;
  const shareId = generateShareId();

  let closesDate: Date;
  if (input.targetClosesAt) {
    const parsed = Date.parse(input.targetClosesAt);
    closesDate = Number.isFinite(parsed) ? new Date(parsed) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
  } else {
    const hours =
      typeof input.timeLeftHours === "number" && Number.isFinite(input.timeLeftHours) && input.timeLeftHours > 0
        ? Math.round(input.timeLeftHours)
        : 14 * 24;
    closesDate = new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  const closesAt = closesDate.toISOString().split("T")[0];
  const summary = input.region ? `${input.category} · ${input.region}` : input.category;

  const { data, error } = await supabase
    .from("questions")
    .insert({
      id,
      creator_id: input.creatorId ?? null,
      title: input.title,
      summary,
      description: input.description ?? null,
      region: input.region ?? null,
      image_url: input.imageUrl ?? null,
      image_credit: input.imageCredit ?? null,
      category: input.category,
      category_icon: cat?.icon ?? "?",
      category_color: cat?.color ?? "#22c55e",
      closes_at: closesAt,
      yes_votes: 0,
      no_votes: 0,
      views: 0,
      status: "new",
      ranking_score: 0,
      visibility: "link_only",
      share_id: shareId,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase createLinkOnlyQuestion fehlgeschlagen: ${error.message}`);
  }
  if (!data) {
    throw new Error("Supabase createLinkOnlyQuestion hat kein Row-Objekt zurueckgegeben.");
  }

  return mapQuestion(data as QuestionRow);
}

async function maybePromoteDraftInSupabase(row: DraftRow): Promise<void> {
  const supabase = getSupabaseAdminClient();

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
            creator_id: row.creator_id ?? null,
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
          visibility: (row.visibility ?? "public") as PollVisibility,
          share_id: row.share_id ?? null,
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

export async function voteOnDraftInSupabase(
  id: string,
  choice: DraftReviewChoice,
  sessionId: string
): Promise<{ draft: Draft | null; alreadyVoted: boolean }> {
  const supabase = getSupabaseAdminClient();

  const { data: row, error } = await supabase.from("drafts").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(`Supabase voteOnDraft (select) fehlgeschlagen: ${error.message}`);
  }
  if (!row) return { draft: null, alreadyVoted: false };

  const draftRow = row as DraftRow;

  // Prevent multiple reviews for the same draft within the same anonymous session.
  const { error: reviewInsertError } = await supabase
    .from("draft_reviews")
    .insert({ draft_id: id, session_id: sessionId, choice });

  if (reviewInsertError) {
    const code = (reviewInsertError as any).code as string | undefined;
    if (code === "23505") {
      return { draft: mapDraftRow(draftRow), alreadyVoted: true };
    }
    if (code === "42P01") {
      throw new Error(
        "Supabase table 'draft_reviews' is missing. Run supabase/draft_reviews.sql in the Supabase SQL Editor first."
      );
    }
    throw new Error(`Supabase voteOnDraft (review insert) fehlgeschlagen: ${reviewInsertError.message}`);
  }

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

  return { draft: mapDraftRow(effectiveRow), alreadyVoted: false };
}
export async function adminAcceptDraftInSupabase(id: string): Promise<Draft | null> {
  const supabase = getSupabaseAdminClient();
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
            creator_id: draftRow.creator_id ?? null,
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
          visibility: (draftRow.visibility ?? "public") as PollVisibility,
          share_id: draftRow.share_id ?? null,
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
  const supabase = getSupabaseAdminClient();
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
  const supabase = getSupabaseAdminClient();
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
  const supabase = getSupabaseAdminClient();
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
  const supabase = getSupabaseAdminClient();
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
