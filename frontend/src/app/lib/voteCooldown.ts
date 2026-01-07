"use client";

export const FV_VOTE_COOLDOWN_DEFAULT_MS = 5000;

const KEY = "fv_vote_cooldown_until";

function safeNow() {
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

export function getVoteCooldownUntil(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    const value = raw ? Number(raw) : 0;
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function setVoteCooldownUntil(untilMs: number): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, String(Math.max(0, untilMs)));
  } catch {
    // ignore
  }
}

export function startVoteCooldown(ms: number = FV_VOTE_COOLDOWN_DEFAULT_MS): number {
  const until = safeNow() + Math.max(0, ms);
  setVoteCooldownUntil(until);
  return until;
}

export function clearVoteCooldown(): void {
  setVoteCooldownUntil(0);
}

export function getVoteCooldownRemainingSeconds(nowMs: number = safeNow()): number {
  const until = getVoteCooldownUntil();
  const diff = until - nowMs;
  if (diff <= 0) return 0;
  return Math.ceil(diff / 1000);
}

