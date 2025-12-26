import "server-only";

import { randomBytes, randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { categories, type AnswerMode, type Draft, type PollOption, type PollVisibility, type Question } from "./mock";
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
  resolution_criteria: string | null;
  resolution_source: string | null;
  resolution_deadline: string | null;
  resolved_outcome: "yes" | "no" | null;
  resolved_option_id?: string | null;
  resolved_at: string | null;
  resolved_source: string | null;
  resolved_note: string | null;
  answer_mode?: AnswerMode | null;
  is_resolvable?: boolean | null;
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

function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.trunc(value)));
}

function percentileInt(sortedValuesAsc: number[], p: number): number {
  if (sortedValuesAsc.length === 0) return 0;
  const pct = Math.min(1, Math.max(0, p));
  const idx = Math.round((sortedValuesAsc.length - 1) * pct);
  return sortedValuesAsc[clampInt(idx, 0, sortedValuesAsc.length - 1)] ?? 0;
}

async function computeDynamicLowVotesThreshold(options: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  now: Date;
  category?: string | null;
  region?: string | null;
}): Promise<number> {
  const { supabase, now, category, region } = options;

  const DEFAULT_THRESHOLD = 5;
  const MIN_THRESHOLD = 5;
  const MAX_THRESHOLD = 50;
  const SAMPLE_LIMIT = 800;
  const MIN_SAMPLE = 30;
  const PERCENTILE = 0.35;

  try {
    const minCreatedAt = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

    let query: any = supabase
      .from("questions")
      .select("yes_votes,no_votes")
      .eq("visibility", "public")
      .not("status", "eq", "archived")
      .gte("created_at", minCreatedAt);

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

    query = query.order("created_at", { ascending: false }).limit(SAMPLE_LIMIT);

    const { data: rows, error } = await query;
    if (error) {
      console.warn("computeDynamicLowVotesThreshold: query failed", error);
      return DEFAULT_THRESHOLD;
    }

    const values = ((rows as any[]) ?? [])
      .map((r) => {
        const yes = Number(r?.yes_votes ?? 0);
        const no = Number(r?.no_votes ?? 0);
        return Math.max(0, Math.max(yes, no));
      })
      .filter((n) => Number.isFinite(n))
      .sort((a, b) => a - b);

    if (values.length < MIN_SAMPLE) {
      return DEFAULT_THRESHOLD;
    }

    const raw = percentileInt(values, PERCENTILE);
    const threshold = clampInt(Math.round(raw), MIN_THRESHOLD, MAX_THRESHOLD);
    return threshold;
  } catch (err) {
    console.warn("computeDynamicLowVotesThreshold: failed", err);
    return 5;
  }
}


type VoteRow = {
  question_id: string;
  session_id: string;
  choice: VoteChoice | null;
  option_id?: string | null;
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
  resolution_criteria: string | null;
  resolution_source: string | null;
  resolution_deadline: string | null;
  answer_mode?: AnswerMode | null;
  is_resolvable?: boolean | null;
};

type QuestionOptionRow = {
  id: string;
  question_id: string;
  label: string;
  sort_order: number;
  votes_count: number;
  created_at?: string;
};

type DraftOptionRow = {
  id: string;
  draft_id: string;
  label: string;
  sort_order: number;
  votes_count: number;
  created_at?: string;
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
            // Nur echte, pro Frage hochgeladene Bilder löschen.
            // Standard-/Shared-Bilder (z. B. question-images/anderebilder/...) dürfen nie gelöscht werden.
            if (!pathInBucket.startsWith("questions/")) return;
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
    if (fileName === "KiLogoBild.jpg") return;
    if (!fileName) return;
    const filePath = path.join(IMAGES_DIR, fileName);

    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error("Failed to delete image file", imageUrl, error);
  }
}

type SessionVote = { choice: VoteChoice | null; optionId: string | null };

function normalizeAnswerMode(value: unknown): AnswerMode {
  return value === "options" ? "options" : "binary";
}

function computeRankingScore(options: { votes: number; views: number; createdAt: string | null }): number {
  const votes = Math.max(0, options.votes);
  const views = Math.max(0, options.views);
  const engagementScore = Math.log(1 + votes);
  const voteRate = votes / Math.max(views, 1);
  const qualityScore = voteRate;

  let createdMs = options.createdAt ? Date.parse(options.createdAt) : NaN;
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

function computeOptionPcts(options: PollOption[] | undefined): PollOption[] | undefined {
  if (!options || options.length === 0) return options;
  const total = options.reduce((sum, opt) => sum + Math.max(0, opt.votesCount ?? 0), 0);
  const denom = Math.max(1, total);
  return options.map((opt) => ({
    ...opt,
    pct: Math.round((Math.max(0, opt.votesCount ?? 0) / denom) * 100),
  }));
}

async function fetchQuestionOptionsMap(options: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  questionIds: string[];
}): Promise<Map<string, PollOption[]>> {
  const { supabase, questionIds } = options;
  const ids = Array.from(new Set(questionIds)).filter(Boolean);
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from("question_options")
    .select("id,question_id,label,sort_order,votes_count")
    .in("question_id", ids)
    .order("question_id", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Supabase question_options (select) fehlgeschlagen: ${error.message}`);
  }

  const map = new Map<string, PollOption[]>();
  for (const raw of (data as QuestionOptionRow[]) ?? []) {
    const row = raw as QuestionOptionRow;
    const arr = map.get(row.question_id) ?? [];
    arr.push({
      id: row.id,
      label: row.label,
      votesCount: Math.max(0, row.votes_count ?? 0),
    });
    map.set(row.question_id, arr);
  }
  return map;
}

async function fetchDraftOptionsMap(options: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  draftIds: string[];
}): Promise<Map<string, PollOption[]>> {
  const { supabase, draftIds } = options;
  const ids = Array.from(new Set(draftIds)).filter(Boolean);
  if (ids.length === 0) return new Map();

  const { data, error } = await supabase
    .from("draft_options")
    .select("id,draft_id,label,sort_order,votes_count")
    .in("draft_id", ids)
    .order("draft_id", { ascending: true })
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Supabase draft_options (select) fehlgeschlagen: ${error.message}`);
  }

  const map = new Map<string, PollOption[]>();
  for (const raw of (data as DraftOptionRow[]) ?? []) {
    const row = raw as DraftOptionRow;
    const arr = map.get(row.draft_id) ?? [];
    arr.push({
      id: row.id,
      label: row.label,
      votesCount: Math.max(0, row.votes_count ?? 0),
    });
    map.set(row.draft_id, arr);
  }
  return map;
}

async function promoteDraftOptionsToQuestion(options: {
  supabase: ReturnType<typeof getSupabaseAdminClient>;
  draftId: string;
  questionId: string;
}): Promise<void> {
  const { supabase, draftId, questionId } = options;

  const { data, error } = await supabase
    .from("draft_options")
    .select("label,sort_order")
    .eq("draft_id", draftId)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(`Supabase promoteDraftOptionsToQuestion (select draft_options) fehlgeschlagen: ${error.message}`);
  }

  const rows = ((data as Partial<DraftOptionRow>[]) ?? [])
    .map((row) => ({
      question_id: questionId,
      label: String(row.label ?? "").trim(),
      sort_order: Number(row.sort_order ?? 0),
    }))
    .filter((row) => row.label && Number.isFinite(row.sort_order) && row.sort_order >= 1 && row.sort_order <= 6);

  if (rows.length === 0) {
    const { error: deleteError } = await supabase.from("question_options").delete().eq("question_id", questionId);
    if (deleteError) {
      throw new Error(
        `Supabase promoteDraftOptionsToQuestion (delete question_options) fehlgeschlagen: ${deleteError.message}`
      );
    }
    return;
  }

  const { error: upsertError } = await supabase
    .from("question_options")
    .upsert(rows, { onConflict: "question_id,sort_order" });

  if (upsertError) {
    throw new Error(`Supabase promoteDraftOptionsToQuestion (upsert question_options) fehlgeschlagen: ${upsertError.message}`);
  }

  const maxSort = rows.reduce((m, r) => Math.max(m, r.sort_order), 0);
  const { error: cleanupError } = await supabase
    .from("question_options")
    .delete()
    .eq("question_id", questionId)
    .gt("sort_order", maxSort);

  if (cleanupError) {
    throw new Error(`Supabase promoteDraftOptionsToQuestion (cleanup) fehlgeschlagen: ${cleanupError.message}`);
  }
}

function mapQuestion(row: QuestionRow, sessionVote?: SessionVote, options?: PollOption[]): QuestionWithVotes {
  const answerMode = normalizeAnswerMode(row.answer_mode ?? "binary");
  const isResolvable = typeof row.is_resolvable === "boolean" ? row.is_resolvable : true;

  const yesVotes = answerMode === "binary" ? (row.yes_votes ?? 0) : 0;
  const noVotes = answerMode === "binary" ? (row.no_votes ?? 0) : 0;
  const optionVotesTotal =
    answerMode === "options"
      ? (options ?? []).reduce((sum, opt) => sum + Math.max(0, opt.votesCount ?? 0), 0)
      : 0;
  const totalBinary = yesVotes + noVotes;
  const totalVotes = answerMode === "options" ? optionVotesTotal : totalBinary;

  const leadingOptionIds =
    answerMode === "options"
      ? (() => {
          const list = options ?? [];
          if (list.length === 0) return [];
          let maxVotes = 0;
          for (const opt of list) {
            maxVotes = Math.max(maxVotes, Math.max(0, opt.votesCount ?? 0));
          }
          if (maxVotes <= 0) return [];
          return list.filter((opt) => Math.max(0, opt.votesCount ?? 0) === maxVotes).map((opt) => opt.id);
        })()
      : undefined;

  const totalForPct = Math.max(1, totalBinary);
  const yesPct = answerMode === "binary" ? Math.round((yesVotes / totalForPct) * 100) : 0;
  const noPct = answerMode === "binary" ? 100 - yesPct : 0;

  const createdAt = row.created_at ?? new Date().toISOString();
  const rankingScore = computeRankingScore({ votes: totalVotes, views: row.views ?? 0, createdAt: row.created_at });

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
    userChoice: sessionVote?.choice ?? undefined,
    userOptionId: sessionVote?.optionId ?? undefined,
    visibility: (row.visibility ?? "public") as PollVisibility,
    shareId: row.share_id ?? undefined,
    answerMode,
    isResolvable,
    options: computeOptionPcts(options),
    leadingOptionIds,
    resolutionCriteria: row.resolution_criteria ?? undefined,
    resolutionSource: row.resolution_source ?? undefined,
    resolutionDeadline: row.resolution_deadline ?? undefined,
    resolvedOutcome: row.resolved_outcome ?? undefined,
    resolvedOptionId: row.resolved_option_id ?? undefined,
    resolvedAt: row.resolved_at ?? undefined,
    resolvedSource: row.resolved_source ?? undefined,
    resolvedNote: row.resolved_note ?? undefined,
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

  const typedRows = rows as QuestionRow[];

  const optionQuestionIds = typedRows
    .filter((row) => normalizeAnswerMode(row.answer_mode ?? "binary") === "options")
    .map((row) => row.id);
  const optionsMap = await fetchQuestionOptionsMap({ supabase, questionIds: optionQuestionIds });

  let sessionVotesMap = new Map<string, SessionVote>();
  if (sessionId) {
    const { data: votes, error: voteError } = await supabase
      .from("votes")
      .select("question_id, choice, option_id")
      .eq("session_id", sessionId);

    if (voteError) {
      throw new Error(`Supabase getQuestions (Votes) fehlgeschlagen: ${voteError.message}`);
    }

    sessionVotesMap = new Map(
      ((votes as VoteRow[]) ?? []).map((v) => [
        v.question_id,
        { choice: v.choice ?? null, optionId: (v as any).option_id ?? null },
      ])
    );
  }

  return typedRows.map((row) => mapQuestion(row, sessionVotesMap.get(row.id), optionsMap.get(row.id)));
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
    .select("question_id, choice, option_id, created_at")
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
      choice: VoteChoice | null;
      optionId: string | null;
      created_at: string;
    }
  >();

  for (const v of voteRows as VoteRow[]) {
    const createdAt = (v.created_at as string | undefined) ?? new Date().toISOString();
    const existing = perQuestion.get(v.question_id);
    if (!existing || createdAt > existing.created_at) {
      perQuestion.set(v.question_id, {
        question_id: v.question_id,
        choice: v.choice ?? null,
        optionId: (v as any).option_id ?? null,
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

  const typedQuestionRows = questionRows as QuestionRow[];
  const optionQuestionIds = typedQuestionRows
    .filter((row) => normalizeAnswerMode(row.answer_mode ?? "binary") === "options")
    .map((row) => row.id);
  const optionsMap = await fetchQuestionOptionsMap({ supabase, questionIds: optionQuestionIds });

  const byId = new Map<string, QuestionRow>();
  for (const row of typedQuestionRows) {
    byId.set(row.id, row);
  }

  const result: QuestionWithUserVote[] = [];
  for (const vote of uniqueVotes) {
    const row = byId.get(vote.question_id);
    if (!row) continue;
    const mapped = mapQuestion(row, { choice: vote.choice, optionId: vote.optionId }, optionsMap.get(row.id));
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
  query?: string | null;
}): Promise<{ items: QuestionWithVotes[]; total: number; nextCursor: string | null }> {
  const { sessionId, limit, offset, cursor, tab, category, region, query: titleQuery } = options;
  const supabase = getSupabaseAdminClient();
  const cursorMode = Boolean(cursor);

  const stopwords = new Set([
    "der",
    "die",
    "das",
    "den",
    "dem",
    "des",
    "ein",
    "eine",
    "einen",
    "einem",
    "einer",
    "und",
    "oder",
    "zum",
    "zur",
    "zu",
    "im",
    "in",
    "am",
    "an",
    "auf",
    "für",
    "fuer",
    "fur",
    "mit",
    "von",
    "bei",
    "ist",
    "sind",
    "wird",
    "werden",
    "dass",
  ]);

  const normalizeForSearch = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  const rawSearch = typeof titleQuery === "string" ? titleQuery : "";
  const normalizedSearch = normalizeForSearch(rawSearch);
  const searchTokens = Array.from(
    new Set(
      normalizedSearch
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !stopwords.has(t))
        .slice(0, 8)
    )
  );
  const searchMode = searchTokens.length > 0;

  const now = new Date();
  const lowVotesThreshold =
    tab === "new"
      ? await computeDynamicLowVotesThreshold({ supabase, now, category, region })
      : null;

  // Votes der aktuellen Session einmalig laden (fuer userChoice und ggf. "unanswered")
  let sessionVotesMap = new Map<string, SessionVote>();
  let votedQuestionIds: string[] = [];
  if (sessionId) {
    const { data: votes, error: voteError } = await supabase
      .from("votes")
      .select("question_id, choice, option_id")
      .eq("session_id", sessionId);

    if (voteError) {
      throw new Error(`Supabase getQuestionsPage (Votes) fehlgeschlagen: ${voteError.message}`);
    }

    const voteRows = (votes as VoteRow[]) ?? [];
    sessionVotesMap = new Map(
      voteRows.map((v) => [
        v.question_id,
        { choice: v.choice ?? null, optionId: (v as any).option_id ?? null },
      ])
    );

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
        .eq("answer_mode", "binary")
        .lte("yes_votes", lowVotesThreshold ?? 5)
        .lte("no_votes", lowVotesThreshold ?? 5);
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

  const scoreTitle = (title: string) => {
    const t = normalizeForSearch(title);
    let score = 0;
    let matched = 0;
    for (const token of searchTokens) {
      const idx = t.indexOf(token);
      if (idx === -1) continue;
      matched += 1;
      score += 10;
      if (idx === 0) score += 6;
      if (t.includes(` ${token} `)) score += 5;
    }
    if (matched === 0) return 0;
    if (normalizedSearch && t.includes(normalizedSearch)) score += 12;
    return score;
  };

  const effectiveCursorMode = cursorMode && !searchMode;

  let totalCount: number | null = null;
  if (effectiveCursorMode) {
    const countQuery = applyFilters(supabase.from("questions").select("id", { count: "exact", head: true }));
    const { error: countError, count } = await countQuery;
    if (countError) {
      throw new Error(`Supabase getQuestionsPage (Count) fehlgeschlagen: ${countError.message}`);
    }
    totalCount = count ?? 0;
  }

  let query = effectiveCursorMode
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

  if (searchMode) {
    const fetchLimit = Math.min(400, Math.max(120, limit * 20));
    query = query.range(0, fetchLimit - 1);
  } else if (effectiveCursorMode) {
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
    return { items: [], total: effectiveCursorMode ? totalCount ?? 0 : count ?? 0, nextCursor: null };
  }

  if (searchMode) {
    const scored = typedRows
      .map((row) => ({ row, score: scoreTitle(row.title ?? "") }))
      .filter((x) => x.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const br = Number((b.row as any).ranking_score ?? 0);
        const ar = Number((a.row as any).ranking_score ?? 0);
        if (br !== ar) return br - ar;
        const bc = String((b.row as any).created_at ?? "");
        const ac = String((a.row as any).created_at ?? "");
        if (bc !== ac) return bc < ac ? -1 : 1;
        return String((b.row as any).id ?? "").localeCompare(String((a.row as any).id ?? ""), "de");
      });

    const picked = scored.slice(0, limit).map((x) => x.row);
    const optionQuestionIds = picked
      .filter((row) => normalizeAnswerMode(row.answer_mode ?? "binary") === "options")
      .map((row) => row.id);
    const optionsMap = await fetchQuestionOptionsMap({ supabase, questionIds: optionQuestionIds });
    const items = picked.map((row) => mapQuestion(row, sessionVotesMap.get(row.id), optionsMap.get(row.id)));
    return { items, total: scored.length, nextCursor: null };
  }

  const total = effectiveCursorMode ? totalCount ?? typedRows.length : count ?? typedRows.length;
  const hasMore = effectiveCursorMode ? typedRows.length > limit : offset + typedRows.length < total;
  const pageRows = effectiveCursorMode && typedRows.length > limit ? typedRows.slice(0, limit) : typedRows;

  const optionQuestionIds = pageRows
    .filter((row) => normalizeAnswerMode(row.answer_mode ?? "binary") === "options")
    .map((row) => row.id);
  const optionsMap = await fetchQuestionOptionsMap({ supabase, questionIds: optionQuestionIds });

  const items = pageRows.map((row) => mapQuestion(row, sessionVotesMap.get(row.id), optionsMap.get(row.id)));

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

  const questionRow = row as QuestionRow;
  const answerMode = normalizeAnswerMode(questionRow.answer_mode ?? "binary");

  const [optionsMap, sessionVote] = await Promise.all([
    answerMode === "options"
      ? fetchQuestionOptionsMap({ supabase, questionIds: [id] })
      : Promise.resolve(new Map<string, PollOption[]>()),
    (async (): Promise<SessionVote | undefined> => {
      if (!sessionId) return undefined;
      const { data: voteRow, error: voteError } = await supabase
        .from("votes")
        .select("choice, option_id")
        .eq("question_id", id)
        .eq("session_id", sessionId)
        .maybeSingle();

      if (voteError) {
        throw new Error(`Supabase getQuestionById (Vote) fehlgeschlagen: ${voteError.message}`);
      }
      if (!voteRow) return undefined;
      return {
        choice: (voteRow as any).choice ?? null,
        optionId: (voteRow as any).option_id ?? null,
      };
    })(),
  ]);

  return mapQuestion(questionRow, sessionVote, optionsMap.get(id));
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
    const qRow = questionRow as QuestionRow;
    const answerMode = normalizeAnswerMode(qRow.answer_mode ?? "binary");

    const [optionsMap, sessionVote] = await Promise.all([
      answerMode === "options"
        ? fetchQuestionOptionsMap({ supabase, questionIds: [qRow.id] })
        : Promise.resolve(new Map<string, PollOption[]>()),
      (async (): Promise<SessionVote | undefined> => {
        if (!sessionId) return undefined;
        const { data: voteRow, error: voteError } = await supabase
          .from("votes")
          .select("choice, option_id")
          .eq("question_id", qRow.id)
          .eq("session_id", sessionId)
          .maybeSingle();

        if (voteError) {
          throw new Error(`Supabase getPollByShareId (vote) fehlgeschlagen: ${voteError.message}`);
        }
        if (!voteRow) return undefined;
        return { choice: (voteRow as any).choice ?? null, optionId: (voteRow as any).option_id ?? null };
      })(),
    ]);

    return {
      kind: "question",
      question: mapQuestion(qRow, sessionVote, optionsMap.get(qRow.id)),
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
    const answerMode = normalizeAnswerMode(draftTyped.answer_mode ?? "binary");
    const isResolvable = typeof draftTyped.is_resolvable === "boolean" ? draftTyped.is_resolvable : true;

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
          answer_mode: answerMode,
          is_resolvable: isResolvable,
          resolution_criteria: draftTyped.resolution_criteria ?? null,
          resolution_source: draftTyped.resolution_source ?? null,
          resolution_deadline: draftTyped.resolution_deadline ?? null,
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      throw new Error(`Supabase getPollByShareId (promote draft) fehlgeschlagen: ${upsertError.message}`);
    }

    if (answerMode === "options") {
      await promoteDraftOptionsToQuestion({ supabase, draftId: draftTyped.id, questionId });
    } else {
      await supabase.from("question_options").delete().eq("question_id", questionId);
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

  const draftOptionsMap =
    normalizeAnswerMode(draftTyped.answer_mode ?? "binary") === "options"
      ? await fetchDraftOptionsMap({ supabase, draftIds: [draftTyped.id] })
      : new Map<string, PollOption[]>();

  return {
    kind: "draft",
    draft: mapDraftRow(draftTyped, draftOptionsMap.get(draftTyped.id)),
    shareId,
    alreadyReviewed,
  };
}

export async function voteOnQuestionInSupabase(
  id: string,
  choice: VoteChoice,
  sessionId: string,
  userId?: string | null
): Promise<QuestionWithVotes | null> {
  const supabase = getSupabaseAdminClient();

  // Doppelvotes in derselben Session verhindern
  const { data: existingVotes, error: existingError } = await supabase
    .from("votes")
    .select("question_id")
    .eq("question_id", id)
    .eq("session_id", sessionId)
    .limit(1);

  if (existingError) {
    throw new Error(`Supabase Vote-Check fehlgeschlagen: ${existingError.message}`);
  }
  if ((existingVotes as any[])?.length) {
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

export async function voteOnQuestionOptionInSupabase(options: {
  questionId: string;
  optionId: string;
  sessionId: string;
  userId?: string | null;
}): Promise<QuestionWithVotes | null> {
  const supabase = getSupabaseAdminClient();
  const { questionId, optionId, sessionId, userId } = options;

  // Doppelvotes in derselben Session verhindern
  const { data: existingVotes, error: existingError } = await supabase
    .from("votes")
    .select("question_id")
    .eq("question_id", questionId)
    .eq("session_id", sessionId)
    .limit(1);

  if (existingError) {
    throw new Error(`Supabase Vote-Check fehlgeschlagen: ${existingError.message}`);
  }
  if ((existingVotes as any[])?.length) {
    return getQuestionByIdFromSupabase(questionId, sessionId);
  }

  const { data: optionRow, error: optionError } = await supabase
    .from("question_options")
    .select("id, question_id, votes_count")
    .eq("id", optionId)
    .maybeSingle();

  if (optionError) {
    throw new Error(`Supabase Option-Check fehlgeschlagen: ${optionError.message}`);
  }
  if (!optionRow || (optionRow as any).question_id !== questionId) {
    throw new Error("Ungültige Option für diese Frage.");
  }

  const now = new Date().toISOString();

  const { error: insertError } = await supabase.from("votes").insert({
    question_id: questionId,
    session_id: sessionId,
    user_id: userId ?? null,
    choice: null,
    option_id: optionId,
    created_at: now,
  });

  if (insertError) {
    throw new Error(`Supabase Vote-Insert fehlgeschlagen: ${insertError.message}`);
  }

  const currentVotes = Math.max(0, Number((optionRow as any).votes_count) || 0);
  const { error: updateError } = await supabase
    .from("question_options")
    .update({ votes_count: currentVotes + 1 })
    .eq("id", optionId);

  if (updateError) {
    throw new Error(`Supabase Vote-Update (option) fehlgeschlagen: ${updateError.message}`);
  }

  return getQuestionByIdFromSupabase(questionId, sessionId);
}

export async function incrementViewsForQuestionInSupabase(questionId: string): Promise<void> {
  const supabase = getSupabaseAdminClient();

  const { data: row, error } = await supabase
    .from("questions")
    .select("views")
    .eq("id", questionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase Views-Select (single) fehlgeschlagen: ${error.message}`);
  }
  if (!row) return;

  const current = (row as any).views ?? 0;
  const next = Math.max(0, Number(current) || 0) + 1;
  const { error: updateError } = await supabase
    .from("questions")
    .update({ views: next })
    .eq("id", questionId);
  if (updateError) {
    throw new Error(`Supabase Views-Update (single) fehlgeschlagen: ${updateError.message}`);
  }
}

// --- Drafts / Review / Admin (Supabase) ------------------------------------

function mapDraftRow(row: DraftRow, options?: PollOption[]): Draft {
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
    answerMode: normalizeAnswerMode(row.answer_mode ?? "binary"),
    isResolvable: typeof row.is_resolvable === "boolean" ? row.is_resolvable : true,
    options: computeOptionPcts(options),
    resolutionCriteria: row.resolution_criteria ?? undefined,
    resolutionSource: row.resolution_source ?? undefined,
    resolutionDeadline: row.resolution_deadline ?? undefined,
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
  const rows = data as DraftRow[];
  const optionDraftIds = rows
    .filter((row) => normalizeAnswerMode(row.answer_mode ?? "binary") === "options")
    .map((row) => row.id);
  const optionsMap = await fetchDraftOptionsMap({ supabase, draftIds: optionDraftIds });
  return rows.map((row) => mapDraftRow(row, optionsMap.get(row.id)));
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
  const rows = data as DraftRow[];
  const optionDraftIds = rows
    .filter((row) => normalizeAnswerMode(row.answer_mode ?? "binary") === "options")
    .map((row) => row.id);
  const optionsMap = await fetchDraftOptionsMap({ supabase, draftIds: optionDraftIds });
  return rows.map((row) => mapDraftRow(row, optionsMap.get(row.id)));
}

export async function getDraftsPageFromSupabase(options: {
  limit: number;
  offset: number;
  cursor?: string | null;
  category?: string | null;
  region?: string | null;
  status?: "all" | "open" | "accepted" | "rejected";
  query?: string | null;
}): Promise<{ items: Draft[]; total: number; nextCursor: string | null }> {
  const { limit, offset, cursor, category, region, status, query: titleQuery } = options;
  const supabase = getSupabaseAdminClient();
  const cursorMode = Boolean(cursor);

  const stopwords = new Set([
    "der",
    "die",
    "das",
    "den",
    "dem",
    "des",
    "ein",
    "eine",
    "einen",
    "einem",
    "einer",
    "und",
    "oder",
    "zum",
    "zur",
    "zu",
    "im",
    "in",
    "am",
    "an",
    "auf",
    "für",
    "fuer",
    "fur",
    "mit",
    "von",
    "bei",
    "ist",
    "sind",
    "wird",
    "werden",
    "dass",
  ]);

  const normalizeForSearch = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFKD")
      .replace(/\p{M}+/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  const rawSearch = typeof titleQuery === "string" ? titleQuery : "";
  const normalizedSearch = normalizeForSearch(rawSearch);
  const searchTokens = Array.from(
    new Set(
      normalizedSearch
        .split(/\s+/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 2 && !stopwords.has(t))
        .slice(0, 8)
    )
  );
  const searchMode = searchTokens.length > 0;

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

  const scoreTitle = (title: string) => {
    const t = normalizeForSearch(title);
    let score = 0;
    let matched = 0;
    for (const token of searchTokens) {
      const idx = t.indexOf(token);
      if (idx === -1) continue;
      matched += 1;
      score += 10;
      if (idx === 0) score += 6;
      if (t.includes(` ${token} `)) score += 5;
    }
    if (matched === 0) return 0;
    if (normalizedSearch && t.includes(normalizedSearch)) score += 12;
    return score;
  };

  const effectiveCursorMode = cursorMode && !searchMode;

  let totalCount: number | null = null;
  if (effectiveCursorMode) {
    const countQuery = applyFilters(supabase.from("drafts").select("id", { count: "exact", head: true }));
    const { error: countError, count } = await countQuery;
    if (countError) {
      throw new Error(`Supabase getDraftsPage (Count) fehlgeschlagen: ${countError.message}`);
    }
    totalCount = count ?? 0;
  }

  let query = effectiveCursorMode ? supabase.from("drafts").select("*") : supabase.from("drafts").select("*", { count: "exact" });
  query = applyFilters(query);

  query = query.order("created_at", { ascending: false }).order("id", { ascending: false });

  const decoded = decodeCursor(cursor);
  if (decoded?.kind == "drafts") {
    const createdAt = normalizeTimestamp(decoded.createdAt);
    query = query.or(
      `created_at.lt.${createdAt},and(created_at.eq.${createdAt},id.lt.${decoded.id})`
    );
  }

  if (searchMode) {
    const fetchLimit = Math.min(400, Math.max(120, limit * 20));
    query = query.range(0, fetchLimit - 1);
  } else if (effectiveCursorMode) {
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
    return { items: [], total: effectiveCursorMode ? totalCount ?? 0 : count ?? 0, nextCursor: null };
  }

  if (searchMode) {
    const scored = rows
      .map((row) => ({ row, score: scoreTitle(row.title ?? "") }))
      .filter((x) => x.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const bc = String((b.row as any).created_at ?? "");
        const ac = String((a.row as any).created_at ?? "");
        if (bc !== ac) return bc < ac ? -1 : 1;
        return String((b.row as any).id ?? "").localeCompare(String((a.row as any).id ?? ""), "de");
      });

    const picked = scored.slice(0, limit).map((x) => x.row);
    const optionDraftIds = picked
      .filter((row) => normalizeAnswerMode(row.answer_mode ?? "binary") === "options")
      .map((row) => row.id);
    const optionsMap = await fetchDraftOptionsMap({ supabase, draftIds: optionDraftIds });
    const items = picked.map((row) => mapDraftRow(row, optionsMap.get(row.id)));
    return { items, total: scored.length, nextCursor: null };
  }

  const total = effectiveCursorMode ? totalCount ?? rows.length : count ?? rows.length;
  const hasMore = effectiveCursorMode ? rows.length > limit : offset + rows.length < total;
  const pageRows = effectiveCursorMode && rows.length > limit ? rows.slice(0, limit) : rows;
  const optionDraftIds = pageRows
    .filter((row) => normalizeAnswerMode(row.answer_mode ?? "binary") === "options")
    .map((row) => row.id);
  const optionsMap = await fetchDraftOptionsMap({ supabase, draftIds: optionDraftIds });
  const items = pageRows.map((row) => mapDraftRow(row, optionsMap.get(row.id)));

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
  answerMode?: AnswerMode;
  isResolvable?: boolean;
  options?: string[];
  resolutionCriteria?: string;
  resolutionSource?: string;
  resolutionDeadline?: string;
}): Promise<Draft> {
  const supabase = getSupabaseAdminClient();
  const id = randomUUID();
  const visibility: PollVisibility = input.visibility === "link_only" ? "link_only" : "public";
  const shareId = visibility === "link_only" ? generateShareId() : null;
  const answerMode = normalizeAnswerMode(input.answerMode ?? "binary");
  const isResolvable = typeof input.isResolvable === "boolean" ? input.isResolvable : true;
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
      answer_mode: answerMode,
      is_resolvable: isResolvable,
      resolution_criteria: input.resolutionCriteria ?? null,
      resolution_source: input.resolutionSource ?? null,
      resolution_deadline: input.resolutionDeadline ?? null,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase createDraft fehlgeschlagen: ${error.message}`);
  }
  if (!data) {
    throw new Error("Supabase createDraft hat kein Row-Objekt zurueckgegeben.");
  }

  const draftRow = data as DraftRow;

  if (answerMode === "options") {
    const rawOptions = Array.isArray(input.options) ? input.options : [];
    const labels = rawOptions
      .map((v) => String(v ?? "").trim())
      .filter((v) => v.length > 0)
      .slice(0, 6);

    if (labels.length < 2) {
      throw new Error("Options-Umfrage braucht mindestens 2 Optionen.");
    }

    const seen = new Set<string>();
    const normalizedLabels: string[] = [];
    for (const label of labels) {
      if (label.length > 80) {
        throw new Error("Option ist zu lang (max. 80 Zeichen).");
      }
      const key = label.toLocaleLowerCase("de-DE");
      if (seen.has(key)) {
        throw new Error("Optionen muessen eindeutig sein.");
      }
      seen.add(key);
      normalizedLabels.push(label);
    }

    const rows = normalizedLabels.map((label, idx) => ({
      draft_id: id,
      label,
      sort_order: idx + 1,
      votes_count: 0,
    }));

    const { data: insertedOptions, error: optionsError } = await supabase
      .from("draft_options")
      .insert(rows)
      .select("id,label,votes_count,sort_order");
    if (optionsError) {
      throw new Error(`Supabase createDraft (draft_options) fehlgeschlagen: ${optionsError.message}`);
    }

    const options = ((insertedOptions as any[]) ?? [])
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      .map((opt) => ({
        id: String(opt.id),
        label: String(opt.label ?? ""),
        votesCount: Math.max(0, Number(opt.votes_count) || 0),
      }));

    return mapDraftRow(draftRow, options);
  }

  return mapDraftRow(draftRow);
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
  answerMode?: AnswerMode;
  isResolvable?: boolean;
  options?: string[];
  resolutionCriteria?: string;
  resolutionSource?: string;
  resolutionDeadline?: string;
}): Promise<QuestionWithVotes> {
  const supabase = getSupabaseAdminClient();

  const cat = categories.find((c) => c.label === input.category) ?? categories[0];
  const id = `q_${randomUUID()}`;
  const shareId = generateShareId();
  const answerMode = normalizeAnswerMode(input.answerMode ?? "binary");
  const isResolvable = typeof input.isResolvable === "boolean" ? input.isResolvable : true;

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
      answer_mode: answerMode,
      is_resolvable: isResolvable,
      resolution_criteria: input.resolutionCriteria ?? null,
      resolution_source: input.resolutionSource ?? null,
      resolution_deadline: input.resolutionDeadline ?? null,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase createLinkOnlyQuestion fehlgeschlagen: ${error.message}`);
  }
  if (!data) {
    throw new Error("Supabase createLinkOnlyQuestion hat kein Row-Objekt zurueckgegeben.");
  }

  const questionRow = data as QuestionRow;

  if (answerMode === "options") {
    const rawOptions = Array.isArray(input.options) ? input.options : [];
    const labels = rawOptions
      .map((v) => String(v ?? "").trim())
      .filter((v) => v.length > 0)
      .slice(0, 6);

    if (labels.length < 2) {
      throw new Error("Options-Umfrage braucht mindestens 2 Optionen.");
    }

    const seen = new Set<string>();
    const normalizedLabels: string[] = [];
    for (const label of labels) {
      if (label.length > 80) {
        throw new Error("Option ist zu lang (max. 80 Zeichen).");
      }
      const key = label.toLocaleLowerCase("de-DE");
      if (seen.has(key)) {
        throw new Error("Optionen muessen eindeutig sein.");
      }
      seen.add(key);
      normalizedLabels.push(label);
    }

    const rows = normalizedLabels.map((label, idx) => ({
      question_id: id,
      label,
      sort_order: idx + 1,
      votes_count: 0,
    }));

    const { data: insertedOptions, error: optionsError } = await supabase
      .from("question_options")
      .insert(rows)
      .select("id,label,votes_count,sort_order");
    if (optionsError) {
      throw new Error(`Supabase createLinkOnlyQuestion (question_options) fehlgeschlagen: ${optionsError.message}`);
    }

    const options = ((insertedOptions as any[]) ?? [])
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))
      .map((opt) => ({
        id: String(opt.id),
        label: String(opt.label ?? ""),
        votesCount: Math.max(0, Number(opt.votes_count) || 0),
      }));

    return mapQuestion(questionRow, undefined, options);
  }

  return mapQuestion(questionRow);
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
    const answerMode = normalizeAnswerMode(row.answer_mode ?? "binary");
    const isResolvable = typeof row.is_resolvable === "boolean" ? row.is_resolvable : true;
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
          answer_mode: answerMode,
          is_resolvable: isResolvable,
          resolution_criteria: row.resolution_criteria ?? null,
          resolution_source: row.resolution_source ?? null,
          resolution_deadline: row.resolution_deadline ?? null,
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      throw new Error(`Supabase maybePromoteDraft (upsert question) fehlgeschlagen: ${upsertError.message}`);
    }

    if (answerMode === "options") {
      await promoteDraftOptionsToQuestion({ supabase, draftId: row.id, questionId });
    } else {
      await supabase.from("question_options").delete().eq("question_id", questionId);
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
      const optionsMap =
        normalizeAnswerMode(draftRow.answer_mode ?? "binary") === "options"
          ? await fetchDraftOptionsMap({ supabase, draftIds: [draftRow.id] })
          : new Map<string, PollOption[]>();
      return { draft: mapDraftRow(draftRow, optionsMap.get(draftRow.id)), alreadyVoted: true };
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

  const optionsMap =
    normalizeAnswerMode(effectiveRow.answer_mode ?? "binary") === "options"
      ? await fetchDraftOptionsMap({ supabase, draftIds: [effectiveRow.id] })
      : new Map<string, PollOption[]>();
  return { draft: mapDraftRow(effectiveRow, optionsMap.get(effectiveRow.id)), alreadyVoted: false };
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
    const answerMode = normalizeAnswerMode(draftRow.answer_mode ?? "binary");
    const isResolvable = typeof draftRow.is_resolvable === "boolean" ? draftRow.is_resolvable : true;
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
          answer_mode: answerMode,
          is_resolvable: isResolvable,
          resolution_criteria: draftRow.resolution_criteria ?? null,
          resolution_source: draftRow.resolution_source ?? null,
          resolution_deadline: draftRow.resolution_deadline ?? null,
        },
        { onConflict: "id" }
      );

    if (upsertError) {
      throw new Error(`Supabase adminAcceptDraft (upsert question) fehlgeschlagen: ${upsertError.message}`);
    }

    if (answerMode === "options") {
      await promoteDraftOptionsToQuestion({ supabase, draftId: draftRow.id, questionId });
    } else {
      await supabase.from("question_options").delete().eq("question_id", questionId);
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

    const finalDraftRow = (acceptedRow ?? draftRow) as DraftRow;
    const optionsMap =
      normalizeAnswerMode(finalDraftRow.answer_mode ?? "binary") === "options"
        ? await fetchDraftOptionsMap({ supabase, draftIds: [finalDraftRow.id] })
        : new Map<string, PollOption[]>();
    return mapDraftRow(finalDraftRow, optionsMap.get(finalDraftRow.id));
  }

  const optionsMap =
    normalizeAnswerMode(draftRow.answer_mode ?? "binary") === "options"
      ? await fetchDraftOptionsMap({ supabase, draftIds: [draftRow.id] })
      : new Map<string, PollOption[]>();
  return mapDraftRow(draftRow, optionsMap.get(draftRow.id));
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

    const finalDraftRow = (updatedRow ?? draftRow) as DraftRow;
    const optionsMap =
      normalizeAnswerMode(finalDraftRow.answer_mode ?? "binary") === "options"
        ? await fetchDraftOptionsMap({ supabase, draftIds: [finalDraftRow.id] })
        : new Map<string, PollOption[]>();
    return mapDraftRow(finalDraftRow, optionsMap.get(finalDraftRow.id));
  }

  const optionsMap =
    normalizeAnswerMode(draftRow.answer_mode ?? "binary") === "options"
      ? await fetchDraftOptionsMap({ supabase, draftIds: [draftRow.id] })
      : new Map<string, PollOption[]>();
  return mapDraftRow(draftRow, optionsMap.get(draftRow.id));
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

  const optionsMap =
    normalizeAnswerMode(draftRow.answer_mode ?? "binary") === "options"
      ? await fetchDraftOptionsMap({ supabase, draftIds: [draftRow.id] })
      : new Map<string, PollOption[]>();
  return mapDraftRow(draftRow, optionsMap.get(draftRow.id));
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

export async function adminResolveQuestionInSupabase(input: {
  id: string;
  outcome?: "yes" | "no" | null;
  resolvedOptionId?: string | null;
  resolvedSource?: string | null;
  resolvedNote?: string | null;
}): Promise<QuestionWithVotes | null> {
  const supabase = getSupabaseAdminClient();

  const outcome = input.outcome === "yes" || input.outcome === "no" ? input.outcome : null;
  const resolvedOptionId = input.resolvedOptionId ? String(input.resolvedOptionId).trim() : null;

  if (outcome && resolvedOptionId) {
    throw new Error("adminResolveQuestionInSupabase: outcome und resolvedOptionId duerfen nicht gleichzeitig gesetzt sein.");
  }

  const resolvedAt = outcome || resolvedOptionId ? new Date().toISOString() : null;

  const { data: updatedRow, error } = await supabase
    .from("questions")
    .update({
      resolved_outcome: outcome,
      resolved_option_id: resolvedOptionId,
      resolved_at: resolvedAt,
      resolved_source: input.resolvedSource ?? null,
      resolved_note: input.resolvedNote ?? null,
    })
    .eq("id", input.id)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase adminResolveQuestion fehlgeschlagen: ${error.message}`);
  }
  if (!updatedRow) return null;

  return mapQuestion(updatedRow as QuestionRow);
}
