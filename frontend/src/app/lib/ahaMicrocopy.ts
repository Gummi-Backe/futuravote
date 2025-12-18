"use client";

const STORAGE_KEY = "fv_aha_v1_shown";

export function hasSeenAhaMicrocopy(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function triggerAhaMicrocopy(payload?: { closesAt?: string | null }) {
  try {
    if (window.localStorage.getItem(STORAGE_KEY) === "1") return;
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // ignore
  }

  try {
    window.dispatchEvent(new CustomEvent("fv:aha", { detail: payload ?? {} }));
  } catch {
    // ignore
  }
}

