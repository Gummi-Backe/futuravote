import assert from "node:assert/strict";
import test from "node:test";
import { getDraftDecisionText, getDraftReviewProgress } from "../src/app/lib/draftReviewRules.ts";

test("review progress uses configured thresholds", () => {
  const progress = getDraftReviewProgress(6, 3, { minTotalReviews: 8, minLead: 3 });

  assert.equal(progress.totalReviews, 9);
  assert.equal(progress.lead, 3);
  assert.equal(progress.thresholdReached, true);
  assert.equal(progress.reviewsRemaining, 0);
  assert.equal(progress.leadRemaining, 0);
});

test("review progress clamps unsafe threshold and vote values", () => {
  const progress = getDraftReviewProgress(-4, 1.4, { minTotalReviews: 0, minLead: Number.NaN });

  assert.equal(progress.totalReviews, 1);
  assert.equal(progress.minTotalReviews, 1);
  assert.equal(progress.minLead, 2);
  assert.equal(progress.thresholdReached, false);
});

test("decision labels distinguish community and moderation", () => {
  assert.equal(getDraftDecisionText("community"), "Durch die Community entschieden.");
  assert.equal(getDraftDecisionText("admin"), "Durch die Moderation entschieden.");
  assert.equal(getDraftDecisionText(undefined), "Entscheidung abgeschlossen.");
});
