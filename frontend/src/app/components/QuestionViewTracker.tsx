"use client";

import { useEffect } from "react";

const STORAGE_PREFIX = "fv_viewed_question_v1:";
const TTL_MS = 30 * 60 * 1000;

export function QuestionViewTracker({ questionId }: { questionId: string }) {
  useEffect(() => {
    if (!questionId) return;
    try {
      const key = `${STORAGE_PREFIX}${questionId}`;
      const now = Date.now();
      const raw = window.sessionStorage.getItem(key);
      const last = raw ? Number(raw) : 0;
      if (Number.isFinite(last) && now - last < TTL_MS) return;

      window.sessionStorage.setItem(key, String(now));

      void fetch(`/api/questions/${encodeURIComponent(questionId)}/view`, {
        method: "POST",
        cache: "no-store",
        keepalive: true,
      }).catch(() => {});
    } catch {
      // ignore
    }
  }, [questionId]);

  return null;
}

