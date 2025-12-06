import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { allQuestions, draftQueue, type Question } from "./mock";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "dev.db");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = new Database(DB_PATH);

db.exec(`
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  categoryIcon TEXT NOT NULL,
  categoryColor TEXT NOT NULL,
  closesAt TEXT NOT NULL,
  yesVotes INTEGER NOT NULL DEFAULT 0,
  noVotes INTEGER NOT NULL DEFAULT 0,
  status TEXT
);

CREATE TABLE IF NOT EXISTS votes (
  questionId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  choice TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (questionId, sessionId),
  FOREIGN KEY (questionId) REFERENCES questions(id) ON DELETE CASCADE
);
`);

// Seed if empty
const countStmt = db.prepare("SELECT COUNT(*) as cnt FROM questions");
const hasQuestions = ((countStmt.get() as { cnt: number | null })?.cnt ?? 0) > 0;
if (!hasQuestions) {
  const insert = db.prepare(
    `INSERT INTO questions (id, title, summary, description, category, categoryIcon, categoryColor, closesAt, yesVotes, noVotes, status)
     VALUES (@id, @title, @summary, @description, @category, @categoryIcon, @categoryColor, @closesAt, @yesVotes, @noVotes, @status)`
  );
  const baseline = 120;
  for (const q of allQuestions) {
    const yesVotes = Math.round((q.yesPct / Math.max(1, q.yesPct + q.noPct)) * baseline);
    const noVotes = Math.max(0, baseline - yesVotes);
    insert.run({ ...q, yesVotes, noVotes });
  }
}

type QuestionRow = {
  id: string;
  title: string;
  summary: string;
  description?: string | null;
  category: string;
  categoryIcon: string;
  categoryColor: string;
  closesAt: string;
  yesVotes: number;
  noVotes: number;
  status?: string | null;
};

export type QuestionWithVotes = Question & { yesVotes: number; noVotes: number };
export type VoteChoice = "yes" | "no";

function mapQuestion(row: QuestionRow, sessionChoice?: VoteChoice): QuestionWithVotes {
  const total = Math.max(1, row.yesVotes + row.noVotes);
  const yesPct = Math.round((row.yesVotes / total) * 100);
  const noPct = 100 - yesPct;
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    description: row.description ?? undefined,
    category: row.category,
    categoryIcon: row.categoryIcon,
    categoryColor: row.categoryColor,
    closesAt: row.closesAt,
    yesVotes: row.yesVotes,
    noVotes: row.noVotes,
    yesPct,
    noPct,
    status: row.status === null ? undefined : (row.status as Question["status"]),
    userChoice: sessionChoice,
  };
}

export function getDrafts() {
  return [...draftQueue];
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
