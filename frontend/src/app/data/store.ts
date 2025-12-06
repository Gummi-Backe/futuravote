import { allQuestions, draftQueue, type Draft, type Question } from "./mock";
import { loadSessionVotes, saveSessionVotes, type SessionVotes } from "./persistence";

export type VoteChoice = "yes" | "no";

export type QuestionWithVotes = Question & {
  yesVotes: number;
  noVotes: number;
};

// Baseline vote count to derive absolute numbers from the seed percentages.
const BASELINE_TOTAL_VOTES = 120;

// In-memory data; good enough for MVP/demo until a real database exists.
const baseQuestions: QuestionWithVotes[] = allQuestions.map((q) => {
  const yesVotes = Math.round((q.yesPct / Math.max(1, q.yesPct + q.noPct)) * BASELINE_TOTAL_VOTES);
  const noVotes = Math.max(0, BASELINE_TOTAL_VOTES - yesVotes);
  return {
    ...q,
    userChoice: undefined, // user-specific in real app; keep unset in shared mock
    yesVotes,
    noVotes,
  };
});

const drafts = [...draftQueue];

function withPercentages(question: QuestionWithVotes, sessionChoice?: VoteChoice): QuestionWithVotes {
  const total = Math.max(1, question.yesVotes + question.noVotes);
  const yesPct = Math.round((question.yesVotes / total) * 100);
  const noPct = 100 - yesPct;
  question.yesPct = yesPct;
  question.noPct = noPct;
  return { ...question, userChoice: sessionChoice ?? question.userChoice };
}

function aggregateVotes(sessionVotes: SessionVotes, sessionId?: string): QuestionWithVotes[] {
  return baseQuestions.map((base) => {
    const votesForQuestion = sessionVotes[base.id] ?? {};
    const yesExtra = Object.values(votesForQuestion).filter((c) => c === "yes").length;
    const noExtra = Object.values(votesForQuestion).filter((c) => c === "no").length;

    const userChoice = sessionId ? votesForQuestion[sessionId] : undefined;
    return withPercentages(
      {
        ...base,
        yesVotes: base.yesVotes + yesExtra,
        noVotes: base.noVotes + noExtra,
      },
      userChoice
    );
  });
}

export async function getQuestions(sessionId?: string): Promise<QuestionWithVotes[]> {
  const sessionVotes = await loadSessionVotes();
  return aggregateVotes(sessionVotes, sessionId);
}

export async function getQuestionById(id: string, sessionId?: string): Promise<QuestionWithVotes | null> {
  const sessionVotes = await loadSessionVotes();
  const question = aggregateVotes(sessionVotes, sessionId).find((q) => q.id === id);
  return question ?? null;
}

export function getDrafts(): Draft[] {
  return drafts;
}

export async function voteOnQuestion(id: string, choice: VoteChoice, sessionId: string): Promise<QuestionWithVotes | null> {
  const sessionVotes = await loadSessionVotes();
  const question = baseQuestions.find((q) => q.id === id);
  if (!question) return null;

  const votesForQuestion = sessionVotes[id] ?? {};
  const previousChoice = votesForQuestion[sessionId];

  if (previousChoice) {
    const updated = aggregateVotes(sessionVotes, sessionId).find((q) => q.id === id);
    return updated ?? null;
  }

  votesForQuestion[sessionId] = choice;
  sessionVotes[id] = votesForQuestion;
  await saveSessionVotes(sessionVotes);

  const updated = aggregateVotes(sessionVotes, sessionId).find((q) => q.id === id);
  return updated ?? null;
}
