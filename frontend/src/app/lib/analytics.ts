"use client";

type AnalyticsPayload = {
  event: string;
  path?: string;
  referrer?: string;
  meta?: Record<string, unknown>;
};

function safeNow() {
  try {
    return Date.now();
  } catch {
    return 0;
  }
}

function shouldSend(key: string, ttlMs: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = window.sessionStorage.getItem(key);
    const last = raw ? Number(raw) : 0;
    const now = safeNow();
    if (Number.isFinite(last) && now - last < ttlMs) return false;
    window.sessionStorage.setItem(key, String(now));
    return true;
  } catch {
    return true;
  }
}

function toTargetPath(url: string): string {
  try {
    const parsed = new URL(url, window.location.origin);
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return url.slice(0, 300);
  }
}

export function trackEvent(event: string, meta?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const trimmed = (event ?? "").trim();
  if (!trimmed) return;

  const path = `${window.location.pathname}${window.location.search}`;
  const key = `fv_ae_${trimmed}_${path}`;
  const ttl = trimmed === "page_view" ? 10_000 : 2_000;
  if (!shouldSend(key, ttl)) return;

  const payload: AnalyticsPayload = {
    event: trimmed.slice(0, 80),
    path: path.slice(0, 300),
    referrer: (document.referrer || "").slice(0, 300) || undefined,
    meta,
  };

  try {
    const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/analytics", blob);
      return;
    }
  } catch {
    // fallback to fetch
  }

  try {
    void fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // ignore
  }
}

export function trackShare(action: "share" | "copy", url: string, method: string) {
  trackEvent(action === "share" ? "share" : "copy", {
    method,
    target: toTargetPath(url),
  });
}

