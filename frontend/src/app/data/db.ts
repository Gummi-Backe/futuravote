import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { allQuestions, draftQueue, categories, type Question, type Draft } from "./mock";

const DATA_ROOT = process.env.DATA_DIR ?? (process.env.VERCEL ? "/tmp/futuravote" : path.join(process.cwd(), "data"));
const DB_PATH = path.join(DATA_ROOT, "dev.db");

if (!fs.existsSync(DATA_ROOT)) {
  fs.mkdirSync(DATA_ROOT, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  region TEXT,
  imageUrl TEXT,
  category TEXT NOT NULL,
  categoryIcon TEXT NOT NULL,
  categoryColor TEXT NOT NULL,
  closesAt TEXT NOT NULL,
  yesVotes INTEGER NOT NULL DEFAULT 0,
  noVotes INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0,
  status TEXT,
  rankingScore REAL NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS votes (
  questionId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  choice TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (questionId, sessionId),
  FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS drafts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  region TEXT,
  imageUrl TEXT,
  category TEXT NOT NULL,
  votesFor INTEGER NOT NULL DEFAULT 0,
  votesAgainst INTEGER NOT NULL DEFAULT 0,
  timeLeftHours INTEGER NOT NULL DEFAULT 72,
  status TEXT NOT NULL DEFAULT 'open',
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  passwordHash TEXT NOT NULL,
  displayName TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  createdAt TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_sessions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
);
`);

// Backfill views column if missing (ältere lokale DBs).
const columns = db.prepare("PRAGMA table_info(questions)").all() as { name: string }[];
const hasViews = columns.some((c) => c.name === "views");
if (!hasViews) {
  db.exec("ALTER TABLE questions ADD COLUMN views INTEGER NOT NULL DEFAULT 0");
}
const hasRanking = columns.some((c) => c.name === "rankingScore");
if (!hasRanking) {
  db.exec("ALTER TABLE questions ADD COLUMN rankingScore REAL NOT NULL DEFAULT 0");
}
const hasCreatedAt = columns.some((c) => c.name === "createdAt");
if (!hasCreatedAt) {
  db.exec("ALTER TABLE questions ADD COLUMN createdAt TEXT");
  db.exec("UPDATE questions SET createdAt = datetime('now') WHERE createdAt IS NULL OR createdAt = ''");
}
const hasRegion = columns.some((c) => c.name === "region");
if (!hasRegion) {
  try {
    db.exec("ALTER TABLE questions ADD COLUMN region TEXT");
  } catch {
    // Falls die Spalte in einer bestehenden lokalen DB bereits existiert, Fehler ignorieren.
  }
}
const hasImageUrl = columns.some((c) => c.name === "imageUrl");
if (!hasImageUrl) {
  try {
    db.exec("ALTER TABLE questions ADD COLUMN imageUrl TEXT");
  } catch {
    // Spalte existiert bereits.
  }
}

// Backfill description / status column for drafts if missing.
const draftColumns = db.prepare("PRAGMA table_info(drafts)").all() as { name: string }[];
const draftsHaveDescription = draftColumns.some((c) => c.name === "description");
if (!draftsHaveDescription) {
  db.exec("ALTER TABLE drafts ADD COLUMN description TEXT");
}
const draftsHaveStatus = draftColumns.some((c) => c.name === "status");
if (!draftsHaveStatus) {
  db.exec("ALTER TABLE drafts ADD COLUMN status TEXT NOT NULL DEFAULT 'open'");
}
const draftsHaveRegion = draftColumns.some((c) => c.name === "region");
if (!draftsHaveRegion) {
  try {
    db.exec("ALTER TABLE drafts ADD COLUMN region TEXT");
  } catch {
    // Spalte existiert bereits - lokal entstandene Duplikate ignorieren.
  }
}
const draftsHaveImageUrl = draftColumns.some((c) => c.name === "imageUrl");
if (!draftsHaveImageUrl) {
  try {
    db.exec("ALTER TABLE drafts ADD COLUMN imageUrl TEXT");
  } catch {
    // Spalte existiert bereits.
  }
}

// Backfill role column for users if missing.
const userColumns = db.prepare("PRAGMA table_info(users)").all() as { name: string }[];
const usersHaveRole = userColumns.some((c) => c.name === "role");
if (!usersHaveRole) {
  try {
    db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  } catch {
    // Spalte existiert bereits.
  }
}

// Seed if empty
const countStmt = db.prepare("SELECT COUNT(*) as cnt FROM questions");
const hasQuestions = ((countStmt.get() as { cnt: number | null })?.cnt ?? 0) > 0;
if (!hasQuestions) {
  const insert = db.prepare(
    `INSERT INTO questions (id, title, summary, description, region, imageUrl, category, categoryIcon, categoryColor, closesAt, yesVotes, noVotes, views, status)
     VALUES (@id, @title, @summary, @description, @region, @imageUrl, @category, @categoryIcon, @categoryColor, @closesAt, @yesVotes, @noVotes, @views, @status)`
  );
  const baseline = 120;
  for (const q of allQuestions) {
    const yesVotes = Math.round((q.yesPct / Math.max(1, q.yesPct + q.noPct)) * baseline);
    const noVotes = Math.max(0, baseline - yesVotes);
    insert.run({
      ...q,
      region: q.region ?? null,
      imageUrl: q.imageUrl ?? null,
      yesVotes,
      noVotes,
      views: q.views ?? 0,
      status: q.status ?? null,
    });
  }
}

type QuestionRow = {
  id: string;
  title: string;
  summary: string;
  description?: string | null;
  region?: string | null;
  imageUrl?: string | null;
  category: string;
  categoryIcon: string;
  categoryColor: string;
  closesAt: string;
  yesVotes: number;
  noVotes: number;
  status?: string | null;
  views: number;
  rankingScore?: number | null;
  createdAt?: string | null;
};

type DraftRow = {
  id: string;
  title: string;
  description?: string | null;
  region?: string | null;
  imageUrl?: string | null;
  category: string;
  votesFor: number;
  votesAgainst: number;
  timeLeftHours: number;
  status?: string | null;
};

export type QuestionWithVotes = Question & {
  yesVotes: number;
  noVotes: number;
  views: number;
  rankingScore: number;
  createdAt: string;
};
export type VoteChoice = "yes" | "no";
export type DraftReviewChoice = "good" | "bad";

export type User = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  role: "user" | "admin";
  createdAt: string;
};

function computeRankingScore(row: QuestionRow): number {
  const votes = Math.max(0, row.yesVotes + row.noVotes);
  const views = Math.max(0, row.views ?? 0);
  const engagementScore = Math.log(1 + votes);
  const voteRate = votes / Math.max(views, 1);
  const qualityScore = voteRate;

  let createdMs = row.createdAt ? Date.parse(row.createdAt) : NaN;
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
  const total = Math.max(1, row.yesVotes + row.noVotes);
  const yesPct = Math.round((row.yesVotes / total) * 100);
  const noPct = 100 - yesPct;
  const createdAt = row.createdAt ?? new Date().toISOString();
  const rankingScore = computeRankingScore({ ...row, createdAt });
  let status: Question["status"] | undefined;
  const closesMs = Date.parse(row.closesAt);
  if (Number.isFinite(closesMs)) {
    const daysLeft = (closesMs - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft <= 14) {
      status = "closingSoon";
    }
  }
  if (!status && row.status && row.status !== "closingSoon") {
    status = row.status as Question["status"];
  }

  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    description: row.description ?? undefined,
    region: row.region ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    category: row.category,
    categoryIcon: row.categoryIcon,
    categoryColor: row.categoryColor,
    closesAt: row.closesAt,
    yesVotes: row.yesVotes,
    noVotes: row.noVotes,
    yesPct,
    noPct,
    status,
    views: row.views ?? 0,
    rankingScore,
    createdAt,
    userChoice: sessionChoice,
  };
}

// Seed drafts table from mock data if empty
const draftCountStmt = db.prepare("SELECT COUNT(*) as cnt FROM drafts");
const hasDrafts = ((draftCountStmt.get() as { cnt: number | null })?.cnt ?? 0) > 0;
if (!hasDrafts) {
  const insertDraft = db.prepare(
    `INSERT INTO drafts (id, title, description, region, imageUrl, category, votesFor, votesAgainst, timeLeftHours, status)
     VALUES (@id, @title, @description, @region, @imageUrl, @category, @votesFor, @votesAgainst, @timeLeftHours, 'open')`
  );
  for (const d of draftQueue) {
    insertDraft.run({
      ...d,
      region: d.region ?? null,
      imageUrl: d.imageUrl ?? null,
    });
  }
}

export function getDrafts(): Draft[] {
  const rows = db
    .prepare(
      "SELECT id, title, description, region, imageUrl, category, votesFor, votesAgainst, timeLeftHours, status FROM drafts"
    )
    .all() as DraftRow[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description ?? undefined,
    region: row.region ?? undefined,
    imageUrl: row.imageUrl ?? undefined,
    category: row.category,
    votesFor: row.votesFor,
    votesAgainst: row.votesAgainst,
    timeLeftHours: row.timeLeftHours,
    status: (row.status ?? "open") as Draft["status"],
  }));
}

export function createDraft(input: {
  title: string;
  category: string;
  description?: string;
  region?: string;
  imageUrl?: string;
  timeLeftHours?: number;
  }): Draft {
  const id = randomUUID();
  const timeLeft =
    typeof input.timeLeftHours === "number" && Number.isFinite(input.timeLeftHours) && input.timeLeftHours > 0
      ? Math.round(input.timeLeftHours)
      : 72;
  const draft: Draft = {
    id,
    title: input.title,
    description: input.description,
    region: input.region,
    imageUrl: input.imageUrl,
    category: input.category,
    votesFor: 0,
    votesAgainst: 0,
    timeLeftHours: timeLeft,
    status: "open",
  };
  db.prepare(
    "INSERT INTO drafts (id, title, description, region, imageUrl, category, votesFor, votesAgainst, timeLeftHours, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(
    draft.id,
    draft.title,
    draft.description ?? null,
    draft.region ?? null,
    draft.imageUrl ?? null,
    draft.category,
    draft.votesFor,
    draft.votesAgainst,
    draft.timeLeftHours,
    "open"
  );
  return draft;
}


function maybePromoteDraft(row: DraftRow) {
  const status = row.status ?? "open";
  if (status !== "open") {
    return;
  }
  const total = row.votesFor + row.votesAgainst;
  if (total < 5) return;
  if (row.votesFor >= row.votesAgainst + 2) {
    const cat = categories.find((c) => c.label === row.category) ?? categories[0];
    const closesAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 180).toISOString().split("T")[0];
    const questionId = row.id.startsWith("q_") ? row.id : `q_${row.id}`;
    const summary = row.region ? `${row.category} · ${row.region}` : row.category;

    db.prepare(
      `INSERT OR IGNORE INTO questions (id, title, summary, description, region, imageUrl, category, categoryIcon, categoryColor, closesAt, yesVotes, noVotes, views, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      questionId,
      row.title,
      summary,
      row.description ?? null,
      row.region ?? null,
      row.imageUrl ?? null,
      row.category,
      cat?.icon ?? "?",
      cat?.color ?? "#22c55e",
      closesAt,
      0,
      0,
      0,
      "new"
    );

    db.prepare("UPDATE drafts SET status = 'accepted' WHERE id = ?").run(row.id);
  } else if (row.votesAgainst >= row.votesFor + 2) {
    db.prepare("UPDATE drafts SET status = 'rejected' WHERE id = ?").run(row.id);
  }
}

export function voteOnDraft(id: string, choice: DraftReviewChoice): Draft | null {
  const updateStmt =
    choice === "good"
      ? db.prepare("UPDATE drafts SET votesFor = votesFor + 1 WHERE id = ?")
      : db.prepare("UPDATE drafts SET votesAgainst = votesAgainst + 1 WHERE id = ?");

  const txn = db.transaction(() => {
    updateStmt.run(id);
  });
  txn();

  const row = db
    .prepare(
      "SELECT id, title, description, region, imageUrl, category, votesFor, votesAgainst, timeLeftHours, status FROM drafts WHERE id = ?"
    )
    .get(id) as DraftRow | undefined;
  if (!row) return null;

  maybePromoteDraft(row);

  const updatedRow = db
    .prepare(
      "SELECT id, title, description, region, imageUrl, category, votesFor, votesAgainst, timeLeftHours, status FROM drafts WHERE id = ?"
    )
    .get(id) as DraftRow | undefined;
  const effective = updatedRow ?? row;

  return {
    id: effective.id,
    title: effective.title,
    description: effective.description ?? undefined,
    category: effective.category,
    votesFor: effective.votesFor,
    votesAgainst: effective.votesAgainst,
    timeLeftHours: effective.timeLeftHours,
    status: (effective.status ?? "open") as Draft["status"],
  };
}

export function getQuestions(sessionId?: string): QuestionWithVotes[] {
  const rows = db.prepare("SELECT * FROM questions").all() as QuestionRow[];
  const sessionVotes =
    sessionId !== undefined
      ? (db.prepare("SELECT questionId, choice FROM votes WHERE sessionId = ?").all(sessionId) as {
          questionId: string;
          choice: VoteChoice;
        }[])
      : [];
  const sessionMap = new Map(sessionVotes.map((v) => [v.questionId, v.choice]));
  return rows.map((row) => mapQuestion(row, sessionMap.get(row.id)));
}

export function getQuestionById(id: string, sessionId?: string): QuestionWithVotes | null {
  const row = db.prepare("SELECT * FROM questions WHERE id = ?").get(id) as QuestionRow | undefined;
  if (!row) return null;
  let sessionChoice: VoteChoice | undefined;
  if (sessionId) {
    const vote = db
      .prepare("SELECT choice FROM votes WHERE questionId = ? AND sessionId = ?")
      .get(id, sessionId) as { choice: VoteChoice } | undefined;
    if (vote) sessionChoice = vote.choice as VoteChoice;
  }
  return mapQuestion(row, sessionChoice);
}

export function voteOnQuestion(id: string, choice: VoteChoice, sessionId: string): QuestionWithVotes | null {
  const alreadyVoted = db
    .prepare("SELECT choice FROM votes WHERE questionId = ? AND sessionId = ?")
    .get(id, sessionId);
  if (alreadyVoted) {
    return getQuestionById(id, sessionId);
  }

  const updateCount =
    choice === "yes"
      ? db.prepare("UPDATE questions SET yesVotes = yesVotes + 1 WHERE id = ?")
      : db.prepare("UPDATE questions SET noVotes = noVotes + 1 WHERE id = ?");
  const insertVote = db.prepare(
    "INSERT INTO votes (questionId, sessionId, choice, createdAt) VALUES (?, ?, ?, datetime('now'))"
  );

  const txn = db.transaction(() => {
    insertVote.run(id, sessionId, choice);
    updateCount.run(id);
  });

  txn();
  return getQuestionById(id, sessionId);
}

export function incrementViewsForAll() {
  db.prepare("UPDATE questions SET views = views + 1").run();
}

// --- User / Auth helpers ----------------------------------------------------

export function createUser(input: {
  email: string;
  passwordHash: string;
  displayName: string;
  role?: "user" | "admin";
}): User {
  const id = randomUUID();
  const role = input.role ?? "user";
  db.prepare("INSERT INTO users (id, email, passwordHash, displayName, role) VALUES (?, ?, ?, ?, ?)").run(
    id,
    input.email,
    input.passwordHash,
    input.displayName,
    role
  );
  const row = db
    .prepare("SELECT id, email, passwordHash, displayName, role, createdAt FROM users WHERE id = ?")
    .get(id) as User;
  return row;
}

export function getUserByEmail(email: string): User | null {
  const row = db
    .prepare("SELECT id, email, passwordHash, displayName, role, createdAt FROM users WHERE email = ?")
    .get(email) as User | undefined;
  return row ?? null;
}

export function createUserSession(userId: string): string {
  const id = randomUUID();
  db.prepare("INSERT INTO user_sessions (id, userId) VALUES (?, ?)").run(id, userId);
  return id;
}

export function getUserBySession(sessionId: string): User | null {
  const row = db
    .prepare(
      `SELECT u.id, u.email, u.passwordHash, u.displayName, u.role, u.createdAt
       FROM user_sessions s
       JOIN users u ON u.id = s.userId
       WHERE s.id = ?`
    )
    .get(sessionId) as User | undefined;
  return row ?? null;
}

export function hasAdminUser(): boolean {
  const row = db.prepare("SELECT 1 FROM users WHERE role = 'admin' LIMIT 1").get() as { 1: number } | undefined;
  return !!row;
}

