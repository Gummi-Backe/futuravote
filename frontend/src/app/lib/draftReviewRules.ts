import type { Draft } from "@/app/data/mock";

export type DraftReviewRules = {
  minTotalReviews: number;
  minLead: number;
};

export const DEFAULT_DRAFT_REVIEW_RULES: DraftReviewRules = {
  minTotalReviews: 5,
  minLead: 2,
};

function positiveInteger(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.round(value)) : fallback;
}

export function getDraftReviewProgress(
  votesFor: number,
  votesAgainst: number,
  rules: DraftReviewRules
) {
  const minTotalReviews = positiveInteger(rules.minTotalReviews, DEFAULT_DRAFT_REVIEW_RULES.minTotalReviews);
  const minLead = positiveInteger(rules.minLead, DEFAULT_DRAFT_REVIEW_RULES.minLead);
  const safeVotesFor = Math.max(0, Math.round(votesFor));
  const safeVotesAgainst = Math.max(0, Math.round(votesAgainst));
  const totalReviews = safeVotesFor + safeVotesAgainst;
  const lead = Math.abs(safeVotesFor - safeVotesAgainst);

  return {
    minTotalReviews,
    minLead,
    totalReviews,
    lead,
    reviewsRemaining: Math.max(0, minTotalReviews - totalReviews),
    leadRemaining: Math.max(0, minLead - lead),
    thresholdReached: totalReviews >= minTotalReviews && lead >= minLead,
  };
}

export function getDraftDecisionText(source: Draft["decisionSource"]): string {
  if (source === "community") return "Durch die Community entschieden.";
  if (source === "admin") return "Durch die Moderation entschieden.";
  return "Entscheidung abgeschlossen.";
}
