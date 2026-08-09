export type FeedVoteDelta =
  | { kind: "binary"; questionId: string; choice: "yes" | "no"; ts: number }
  | { kind: "options"; questionId: string; optionId: string; ts: number };

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type FeedVoteDeltaInput = DistributiveOmit<FeedVoteDelta, "ts">;

const FEED_VOTE_DELTAS_STORAGE_KEY = "fv_feed_vote_deltas_v1";
const MAX_DELTAS = 50;

function safeReadDeltas(): FeedVoteDelta[] {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.sessionStorage.getItem(FEED_VOTE_DELTAS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is FeedVoteDelta => {
      if (!isRecord(item)) return false;
      const kind = item.kind;
      const questionId = item.questionId;
      const ts = item.ts;
      if (typeof questionId !== "string" || typeof ts !== "number") return false;
      if (kind === "binary") return item.choice === "yes" || item.choice === "no";
      if (kind === "options") return typeof item.optionId === "string";
      return false;
    });
  } catch {
    return [];
  }
}

export function recordFeedVoteDelta(delta: FeedVoteDeltaInput & { ts?: number }) {
  try {
    if (typeof window === "undefined") return;
    const existing = safeReadDeltas();
    const ts = typeof delta.ts === "number" ? delta.ts : Date.now();
    const next: FeedVoteDelta =
      delta.kind === "binary"
        ? { kind: "binary", questionId: delta.questionId, choice: delta.choice, ts }
        : { kind: "options", questionId: delta.questionId, optionId: delta.optionId, ts };
    const merged = [next, ...existing].slice(0, MAX_DELTAS);
    window.sessionStorage.setItem(FEED_VOTE_DELTAS_STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // ignore
  }
}

export function consumeFeedVoteDeltas(): FeedVoteDelta[] {
  try {
    if (typeof window === "undefined") return [];
    const existing = safeReadDeltas();
    window.sessionStorage.removeItem(FEED_VOTE_DELTAS_STORAGE_KEY);
    return existing.slice(0, MAX_DELTAS);
  } catch {
    return [];
  }
}
import { isRecord } from "@/app/lib/unknownValue";
