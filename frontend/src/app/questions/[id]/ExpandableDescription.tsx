"use client";

import { useId, useState } from "react";
import { FormattedText } from "@/app/components/FormattedText";
import { QuestionUpdatesSection } from "./QuestionUpdatesSection";

type QuestionUpdateItem = {
  id: string;
  questionId: string;
  userId: string;
  authorName: string;
  body: string;
  sourceUrl: string | null;
  sourceUrls: string[];
  createdAt: string;
};

export function ExpandableDescription(props: {
  shortText: string;
  longText: string | null;
  questionId?: string;
  questionTitle?: string;
  initialUpdates?: QuestionUpdateItem[];
  isLoggedIn?: boolean;
  isOwner?: boolean;
  isAdmin?: boolean;
}) {
  const { shortText, longText } = props;
  const [open, setOpen] = useState(false);
  const [updatesCreateOpen, setUpdatesCreateOpen] = useState(false);
  const longId = useId();
  const hasLongText = Boolean(longText && longText.trim().length > 0);
  const hasUpdatesConfig = Boolean(props.questionId && props.questionTitle);
  const isOwner = Boolean(props.isOwner);
  const [publishedUpdates, setPublishedUpdates] = useState<QuestionUpdateItem[]>(props.initialUpdates ?? []);
  const hasPublishedUpdates = publishedUpdates.length > 0;

  const formatTime = (value: string) => {
    const ms = Date.parse(value);
    if (!Number.isFinite(ms)) return value;
    return new Date(ms).toLocaleString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="mt-4">
      <div
        role={hasLongText ? "button" : undefined}
        tabIndex={hasLongText ? 0 : undefined}
        aria-expanded={hasLongText ? open : undefined}
        aria-controls={hasLongText ? longId : undefined}
        className={`rounded-md ${hasLongText ? "cursor-pointer hover:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300/60" : ""}`}
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
        <FormattedText
          text={shortText}
          className="space-y-2 text-sm text-slate-200 sm:text-base"
          paragraphClassName="text-sm text-slate-200 sm:text-base"
        />
      </div>

      {hasLongText ? (
        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              aria-expanded={open}
              aria-controls={longId}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-300/45 bg-emerald-500/15 px-4 py-1.5 text-xs font-semibold text-emerald-100 transition hover:border-emerald-200/70 hover:bg-emerald-500/25"
            >
              {open ? "Weniger anzeigen" : "Ausführlichen Hintergrund anzeigen"}
            </button>
            {hasUpdatesConfig && isOwner ? (
              <button
                type="button"
                onClick={() => setUpdatesCreateOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/45 bg-cyan-500/15 px-4 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-500/25"
              >
                Updates erstellen
              </button>
            ) : null}
          </div>

          {open ? (
            <div
              id={longId}
              className="mt-3 rounded-2xl border border-white/10 bg-black/20 p-4"
            >
              <FormattedText
                text={longText ?? ""}
                className="space-y-3 text-sm text-slate-200 sm:text-base"
                paragraphClassName="text-sm text-slate-200 sm:text-base"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {!hasLongText && hasUpdatesConfig && isOwner ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setUpdatesCreateOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/45 bg-cyan-500/15 px-4 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-500/25"
          >
            Updates erstellen
          </button>
        </div>
      ) : null}

      {hasUpdatesConfig && hasPublishedUpdates ? (
        <section className="mt-3 space-y-3 rounded-2xl border border-cyan-300/30 bg-cyan-500/10 p-3 sm:p-4">
          <h3 className="text-sm font-semibold text-cyan-50">Updates zur Frage</h3>
          {publishedUpdates.map((item) => (
            <article key={item.id} className="rounded-2xl border border-white/10 bg-black/20 px-4 py-3 shadow-sm shadow-black/20">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-100">{item.authorName}</span>
                <span className="text-[11px] text-slate-400">{formatTime(item.createdAt)}</span>
              </div>
              <FormattedText
                text={item.body}
                className="mt-2 space-y-2 text-sm text-slate-200"
                paragraphClassName="text-sm text-slate-200"
              />
              {(() => {
                const allSources = [...(item.sourceUrls ?? []), item.sourceUrl ?? ""]
                  .map((value) => value.trim())
                  .filter(Boolean);
                const deduped: string[] = [];
                const seen = new Set<string>();
                for (const value of allSources) {
                  const key = value.toLowerCase();
                  if (seen.has(key)) continue;
                  seen.add(key);
                  deduped.push(value);
                  if (deduped.length >= 8) break;
                }
                if (deduped.length === 0) return null;
                return (
                  <div className="mt-2 space-y-1">
                    {deduped.map((url) => (
                      <a
                        key={url}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                        className="block break-all text-xs font-semibold text-emerald-200 hover:text-emerald-100"
                      >
                        Quelle: {url}
                      </a>
                    ))}
                  </div>
                );
              })()}
            </article>
          ))}
        </section>
      ) : null}

      {hasUpdatesConfig && isOwner && updatesCreateOpen ? (
        <QuestionUpdatesSection
          questionId={props.questionId!}
          questionTitle={props.questionTitle!}
          initialUpdates={publishedUpdates}
          isLoggedIn={Boolean(props.isLoggedIn)}
          isOwner={isOwner}
          isAdmin={Boolean(props.isAdmin)}
          showPublishedUpdates={false}
          embedded
          onUpdatePublished={(next) =>
            setPublishedUpdates((prev) => {
              if (prev.some((item) => item.id === next.id)) return prev;
              return [next, ...prev];
            })
          }
        />
      ) : null}
    </div>
  );
}
