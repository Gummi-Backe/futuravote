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
  variant?: "chip" | "primary";
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
      : "inline-flex min-w-fit items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5";
  const style =
    variant === "primary"
      ? "border-emerald-300/60 bg-emerald-500/20 text-white hover:bg-emerald-500/30"
      : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40";

  return (
    <button type="button" onClick={onClick} className={`${base} ${style} ${className}`}>
      {copied ? "Kopiert" : label}
    </button>
  );
}
