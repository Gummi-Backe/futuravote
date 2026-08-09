export const FUNNEL_EVENT_NAMES = [
  "page_view",
  "feed_impression",
  "question_open",
  "vote_start",
  "vote_question",
  "share_prompt_view",
  "share",
  "copy",
  "register",
] as const;

export const FUNNEL_TRACKING_STARTED_AT = "2026-08-09T00:00:00.000Z";

export type FunnelEventRow = {
  event?: string | null;
  session_id?: string | null;
  path?: string | null;
};

type StageSets = {
  home: Set<string>;
  feed: Set<string>;
  questionOpen: Set<string>;
  voteStart: Set<string>;
  vote: Set<string>;
  sharePrompt: Set<string>;
  share: Set<string>;
  register: Set<string>;
};

function isHomePath(path: string | null | undefined): boolean {
  return path === "/" || Boolean(path?.startsWith("/?"));
}

function intersectionPct(from: Set<string>, to: Set<string>): number {
  if (from.size === 0) return 0;
  let matched = 0;
  for (const sessionId of from) {
    if (to.has(sessionId)) matched += 1;
  }
  return Math.round((matched / from.size) * 1000) / 10;
}

export function buildFunnel14d(rows: FunnelEventRow[]) {
  const stages: StageSets = {
    home: new Set<string>(),
    feed: new Set<string>(),
    questionOpen: new Set<string>(),
    voteStart: new Set<string>(),
    vote: new Set<string>(),
    sharePrompt: new Set<string>(),
    share: new Set<string>(),
    register: new Set<string>(),
  };

  for (const row of rows) {
    const sessionId = typeof row.session_id === "string" ? row.session_id.trim() : "";
    if (!sessionId) continue;

    if (row.event === "page_view" && isHomePath(row.path)) stages.home.add(sessionId);
    if (row.event === "feed_impression") stages.feed.add(sessionId);
    if (row.event === "question_open") stages.questionOpen.add(sessionId);
    if (row.event === "vote_start") stages.voteStart.add(sessionId);
    if (row.event === "vote_question") stages.vote.add(sessionId);
    if (row.event === "share_prompt_view") stages.sharePrompt.add(sessionId);
    if (row.event === "share" || row.event === "copy") stages.share.add(sessionId);
    if (row.event === "register") stages.register.add(sessionId);
  }

  return {
    trackingStartedAt: FUNNEL_TRACKING_STARTED_AT,
    stages: {
      homeSessions: stages.home.size,
      feedImpressions: stages.feed.size,
      questionOpens: stages.questionOpen.size,
      voteStarts: stages.voteStart.size,
      voters: stages.vote.size,
      sharePromptViews: stages.sharePrompt.size,
      sharers: stages.share.size,
      registrations: stages.register.size,
    },
    conversions: {
      homeToFeedPct: intersectionPct(stages.home, stages.feed),
      feedToQuestionOpenPct: intersectionPct(stages.feed, stages.questionOpen),
      feedToVoteStartPct: intersectionPct(stages.feed, stages.voteStart),
      voteStartToVotePct: intersectionPct(stages.voteStart, stages.vote),
      voteToSharePromptPct: intersectionPct(stages.vote, stages.sharePrompt),
      sharePromptToSharePct: intersectionPct(stages.sharePrompt, stages.share),
      homeToRegisterPct: intersectionPct(stages.home, stages.register),
    },
  };
}
