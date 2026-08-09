import assert from "node:assert/strict";
import test from "node:test";
import { buildFunnel14d } from "../src/app/lib/analyticsFunnel.ts";

test("14-day funnel counts unique sessions per stage", () => {
  const result = buildFunnel14d([
    { event: "page_view", session_id: "a", path: "/" },
    { event: "page_view", session_id: "a", path: "/" },
    { event: "feed_impression", session_id: "a", path: "/" },
    { event: "question_open", session_id: "a", path: "/questions/1" },
    { event: "vote_start", session_id: "a", path: "/questions/1" },
    { event: "vote_question", session_id: "a", path: "/questions/1" },
    { event: "share_prompt_view", session_id: "a", path: "/" },
    { event: "share", session_id: "a", path: "/" },
    { event: "page_view", session_id: "b", path: "/?q=rente" },
    { event: "feed_impression", session_id: "b", path: "/?q=rente" },
  ]);

  assert.deepEqual(result.stages, {
    homeSessions: 2,
    feedImpressions: 2,
    questionOpens: 1,
    voteStarts: 1,
    voters: 1,
    sharePromptViews: 1,
    sharers: 1,
    registrations: 0,
  });
  assert.equal(result.conversions.homeToFeedPct, 100);
  assert.equal(result.conversions.feedToQuestionOpenPct, 50);
  assert.equal(result.conversions.feedToVoteStartPct, 50);
  assert.equal(result.conversions.voteStartToVotePct, 100);
  assert.equal(result.conversions.voteToSharePromptPct, 100);
  assert.equal(result.conversions.sharePromptToSharePct, 100);
});

test("funnel conversions only count sessions present in the previous stage", () => {
  const result = buildFunnel14d([
    { event: "page_view", session_id: "home", path: "/" },
    { event: "share", session_id: "direct-share", path: "/questions/2" },
    { event: "register", session_id: "direct-register", path: "/auth" },
    { event: "page_view", session_id: "detail", path: "/questions/2" },
  ]);

  assert.equal(result.stages.homeSessions, 1);
  assert.equal(result.stages.sharers, 1);
  assert.equal(result.conversions.sharePromptToSharePct, 0);
  assert.equal(result.conversions.homeToRegisterPct, 0);
});
