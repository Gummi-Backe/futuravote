"use client";

import { useCallback, useEffect, useState } from "react";
import { trackShare } from "@/app/lib/analytics";

export function ShareLinkButton({
  url,
  label = "Teilen",
  className = "",
  variant = "chip",
  action = "share",
  shareTitle,
  shareText,
}: {
  url: string;
  label?: string;
  className?: string;
  variant?: "chip" | "primary" | "icon";
  action?: "share" | "copy";
  shareTitle?: string;
  shareText?: string;
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
          await (navigator as any).share({ url, title: shareTitle, text: shareText });
          trackShare("share", url, "native");
          return;
        }
      } catch {
        // User canceled share dialog - fall through to copy.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      trackShare("copy", url, "clipboard");
    } catch {
      window.prompt("Link kopieren:", url);
      trackShare("copy", url, "prompt");
    }
  }, [action, shareText, shareTitle, url]);

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
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <path
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M20 6 9 17l-5-5"
        />
      </svg>
    ) : action === "copy" ? (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <rect
          x="6"
          y="6"
          width="11"
          height="11"
          rx="2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <rect
          x="9"
          y="9"
          width="11"
          height="11"
          rx="2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
        />
        <path
          d="M12.2 14.7l1.7-1.7a1.7 1.7 0 0 1 2.4 2.4l-1.7 1.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M11.8 15.3l-1.7 1.7a1.7 1.7 0 0 1-2.4-2.4l1.7-1.7"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
        <circle cx="18" cy="5" r="2.6" fill="currentColor" />
        <circle cx="6" cy="12" r="2.6" fill="currentColor" />
        <circle cx="18" cy="19" r="2.6" fill="currentColor" />
        <path
          d="M8.3 11.1 15.7 6.4M8.3 12.9 15.7 17.6"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
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
