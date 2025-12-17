"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

function escapeHtmlAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function EmbedWidgetButton({
  widgetUrl,
  title,
  className = "",
  variant = "chip",
}: {
  widgetUrl: string;
  title: string;
  className?: string;
  variant?: "chip" | "icon";
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 1200);
    return () => window.clearTimeout(t);
  }, [copied]);

  const embedCode = useMemo(() => {
    const safeTitle = escapeHtmlAttribute(title || "Future-Vote Widget");
    const safeUrl = escapeHtmlAttribute(widgetUrl);
    return `<iframe src="${safeUrl}" title="${safeTitle}" style="width:100%;max-width:560px;height:320px;border:0;border-radius:24px;overflow:hidden" loading="lazy"></iframe>`;
  }, [title, widgetUrl]);

  const onClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(embedCode);
      setCopied(true);
    } catch {
      window.prompt("Embed-Code kopieren:", embedCode);
    }
  }, [embedCode]);

  const base =
    variant === "icon"
      ? "inline-flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5"
      : "inline-flex min-w-fit items-center justify-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5";
  const style = "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40";

  const icon = (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        d="M8 8l-4 4 4 4M16 8l4 4-4 4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const label = copied ? "Kopiert" : "Einbetten";
  const ariaLabel = copied ? "Embed-Code kopiert" : "Embed-Code kopieren";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${style} ${className}`}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      {variant === "icon" ? icon : copied ? "Kopiert" : (
        <>
          {icon}
          {label}
        </>
      )}
    </button>
  );
}

