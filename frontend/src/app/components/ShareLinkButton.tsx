"use client";

import { useCallback, useEffect, useState } from "react";

export function ShareLinkButton({
  url,
  label = "Teilen",
  className = "",
  variant = "chip",
  action = "share",
}: {
  url: string;
  label?: string;
  className?: string;
  variant?: "chip" | "primary" | "icon";
  action?: "share" | "copy";
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

  const onClick = useCallback(async () => {
    if (action === "share") {
      try {
        if (typeof navigator !== "undefined" && "share" in navigator && typeof (navigator as any).share === "function") {
          await (navigator as any).share({ url });
          return;
        }
      } catch {
        // User canceled share dialog - fall through to copy.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      window.prompt("Link kopieren:", url);
    }
  }, [action, url]);

  const base =
    variant === "primary"
      ? "inline-flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg shadow-emerald-500/20 transition hover:-translate-y-0.5"
      : variant === "icon"
        ? "inline-flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5"
        : "inline-flex min-w-fit items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5";
  const style =
    variant === "primary"
      ? "border-emerald-300/60 bg-emerald-500/20 text-white hover:bg-emerald-500/30"
      : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40";

  const icon =
    copied ? (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"
        />
      </svg>
    ) : action === "copy" ? (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M3.9 12a5 5 0 0 1 5-5h4v2h-4a3 3 0 0 0 0 6h4v2h-4a5 5 0 0 1-5-5zm7.1 1h2v-2h-2v2zm4-6h4a5 5 0 0 1 0 10h-4v-2h4a3 3 0 1 0 0-6h-4V7z"
        />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
        <path
          fill="currentColor"
          d="M15 8a3 3 0 1 0-2.8-4H6a4 4 0 0 0-4 4v12a4 4 0 0 0 4 4h12a4 4 0 0 0 4-4v-6.2A3 3 0 0 0 20 15a3 3 0 0 0-3-3V8h-2zm-1 0v6h6v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6.2A3 3 0 0 0 14 8zm1-4a1 1 0 1 1 0 2 1 1 0 0 1 0-2z"
        />
      </svg>
    );

  const ariaLabel = copied ? "Kopiert" : label;

  return (
    <button type="button" onClick={onClick} className={`${base} ${style} ${className}`} aria-label={ariaLabel} title={ariaLabel}>
      {variant === "icon" ? icon : copied ? "Kopiert" : label}
    </button>
  );
}
