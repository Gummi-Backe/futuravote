"use client";

const STORAGE_KEY = "fv_aha_v1_shown";

export type AhaMicrocopyPayload = {
  closesAt?: string | null;
  questionId?: string;
  questionTitle?: string;
  shareUrl?: string;
  choiceLabel?: string;
};

export function hasSeenAhaMicrocopy(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function triggerAhaMicrocopy(payload?: AhaMicrocopyPayload) {
  let firstVote = true;
  try {
    firstVote = window.localStorage.getItem(STORAGE_KEY) !== "1";
    if (firstVote) window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore
  }

  try {
    window.dispatchEvent(new CustomEvent("fv:aha", { detail: { ...(payload ?? {}), firstVote } }));
  } catch {
    // ignore
  }
}
