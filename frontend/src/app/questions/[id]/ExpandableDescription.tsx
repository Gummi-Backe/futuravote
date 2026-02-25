"use client";

import { useId, useState } from "react";

function splitIntoParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export function ExpandableDescription(props: {
  shortText: string;
  longText: string | null;
}) {
  const { shortText, longText } = props;
  const [open, setOpen] = useState(false);
  const longId = useId();
  const hasLongText = Boolean(longText && longText.trim().length > 0);
  const paragraphs = hasLongText ? splitIntoParagraphs(longText as string) : [];

  return (
    <div className="mt-4">
      <p
        role={hasLongText ? "button" : undefined}
        tabIndex={hasLongText ? 0 : undefined}
        aria-expanded={hasLongText ? open : undefined}
        aria-controls={hasLongText ? longId : undefined}
        className={`text-sm text-slate-200 sm:text-base ${hasLongText ? "cursor-pointer hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60 rounded-md" : ""}`}
        onClick={hasLongText ? () => setOpen((prev) => !prev) : undefined}
        onKeyDown={
          hasLongText
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setOpen((prev) => !prev);
                }
              }
            : undefined
        }
      >
        {shortText}
      </p>

      {hasLongText ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setOpen((prev) => !prev)}
            aria-expanded={open}
            aria-controls={longId}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-300/45 bg-emerald-500/15 px-4 py-1.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-500/25"
          >
            {open ? "Weniger anzeigen" : "Ausführlichen Hintergrund anzeigen"}
          </button>

          {open ? (
            <div
              id={longId}
              className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200 sm:text-base"
            >
              <div className="space-y-3">
                {paragraphs.length > 0 ? (
                  paragraphs.map((part, idx) => <p key={`${idx}-${part.slice(0, 24)}`}>{part}</p>)
                ) : (
                  <p>{longText}</p>
                )}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

