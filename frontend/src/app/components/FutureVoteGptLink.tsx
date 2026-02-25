"use client";

import { useCallback, useState } from "react";

type FutureVoteGptLinkProps = {
  href: string;
  prompt?: string;
  className?: string;
  label?: string;
};

export function FutureVoteGptLink({
  href,
  prompt,
  className,
  label = "Mit FutureVote GPT sprechen",
}: FutureVoteGptLinkProps) {
  const [copied, setCopied] = useState(false);
  const baseClassName =
    "inline-flex items-center justify-center rounded-xl border border-cyan-200/40 bg-cyan-500/15 px-3 py-2 text-xs font-semibold text-cyan-50 shadow-lg shadow-cyan-900/20 transition hover:-translate-y-0.5 hover:border-cyan-200/70 hover:bg-cyan-500/25";

  const handleClick = useCallback(
    async (event: React.MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault();

      let textToCopy = String(prompt ?? "").trim();
      if (!textToCopy) {
        try {
          const parsed = new URL(href);
          textToCopy = String(parsed.searchParams.get("q") ?? "").trim();
        } catch {
          textToCopy = "";
        }
      }
      if (textToCopy && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(textToCopy);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2200);
        } catch {
          // ignore clipboard issues, link will still open
        }
      }

      if (typeof window !== "undefined") {
        window.open(href, "_blank", "noopener,noreferrer");
      }
    },
    [href, prompt]
  );

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={handleClick}
      className={`${baseClassName} ${className ?? ""}`}
      title="Öffnet den FutureVote GPT. Kontext wird in die Zwischenablage kopiert."
    >
      {copied ? "Kontext kopiert - GPT geöffnet" : label}
    </a>
  );
}
