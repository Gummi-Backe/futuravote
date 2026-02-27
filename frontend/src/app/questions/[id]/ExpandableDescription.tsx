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
  const [updatesOpen, setUpdatesOpen] = useState(false);
  const longId = useId();
  const hasLongText = Boolean(longText && longText.trim().length > 0);
  const hasUpdatesConfig = Boolean(props.questionId && props.questionTitle);
  const updatesButtonLabel = props.isOwner ? "Updates anzeigen / hinzufügen" : "Updates anzeigen";

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
            {hasUpdatesConfig ? (
              <button
                type="button"
                onClick={() => setUpdatesOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 rounded-full border border-cyan-300/45 bg-cyan-500/15 px-4 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-500/25"
              >
                {updatesOpen ? "Updates ausblenden" : updatesButtonLabel}
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

          {hasUpdatesConfig && updatesOpen ? (
            <QuestionUpdatesSection
              questionId={props.questionId!}
              questionTitle={props.questionTitle!}
              initialUpdates={props.initialUpdates ?? []}
              isLoggedIn={Boolean(props.isLoggedIn)}
              isOwner={Boolean(props.isOwner)}
              isAdmin={Boolean(props.isAdmin)}
              showPublishedUpdates
              embedded
            />
          ) : null}
        </div>
      ) : null}

      {!hasLongText && hasUpdatesConfig ? (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setUpdatesOpen((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/45 bg-cyan-500/15 px-4 py-1.5 text-xs font-semibold text-cyan-100 transition hover:border-cyan-200/70 hover:bg-cyan-500/25"
          >
            {updatesOpen ? "Updates ausblenden" : updatesButtonLabel}
          </button>
          {updatesOpen ? (
            <QuestionUpdatesSection
              questionId={props.questionId!}
              questionTitle={props.questionTitle!}
              initialUpdates={props.initialUpdates ?? []}
              isLoggedIn={Boolean(props.isLoggedIn)}
              isOwner={Boolean(props.isOwner)}
              isAdmin={Boolean(props.isAdmin)}
              showPublishedUpdates
              embedded
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
