import assert from "node:assert/strict";
import test from "node:test";
import {
  computeDefaultResolutionDeadlineIso,
  expectedPollCloseMs,
  resolutionDeadlineFollowsPollClose,
} from "../src/app/lib/draftValidation.ts";

const NOW = Date.parse("2026-08-09T10:00:00.000Z");

test("explicit poll close controls the minimum resolution deadline", () => {
  assert.equal(
    resolutionDeadlineFollowsPollClose({
      resolutionDeadline: "2026-09-02T00:00:00.000Z",
      targetClosesAt: "2026-09-01T00:00:00.000Z",
      reviewHours: 72,
      defaultPollDays: 14,
      nowMs: NOW,
    }),
    true
  );
  assert.equal(
    resolutionDeadlineFollowsPollClose({
      resolutionDeadline: "2026-09-01T00:00:00.000Z",
      targetClosesAt: "2026-09-01T00:00:00.000Z",
      reviewHours: 72,
      defaultPollDays: 14,
      nowMs: NOW,
    }),
    false
  );
});

test("default close includes review time plus the voting period", () => {
  assert.equal(
    expectedPollCloseMs({ reviewHours: 72, defaultPollDays: 14, nowMs: NOW }),
    NOW + (72 + 14 * 24) * 60 * 60 * 1000
  );
});

test("invalid deadlines are rejected", () => {
  assert.equal(
    resolutionDeadlineFollowsPollClose({
      resolutionDeadline: "invalid",
      reviewHours: 72,
      defaultPollDays: 14,
      nowMs: NOW,
    }),
    false
  );
});

test("default deadline is deterministic when a clock is supplied", () => {
  assert.equal(
    computeDefaultResolutionDeadlineIso({ timeLeftHours: 72, nowMs: NOW }),
    "2026-09-12T10:00:00.000Z"
  );
});
