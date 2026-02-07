"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { categories, type Draft, type Question } from "./data/mock";
import { invalidateProfileCaches } from "./lib/profileCache";
import { triggerAhaMicrocopy } from "./lib/ahaMicrocopy";
import { consumeFeedVoteDeltas, recordFeedVoteDelta } from "./lib/feedVoteSync";
import {
  clearVoteCooldown,
  FV_VOTE_COOLDOWN_DEFAULT_MS,
  getVoteCooldownRemainingSeconds,
  setVoteCooldownUntil,
} from "./lib/voteCooldown";
import { ReportButton } from "./components/ReportButton";
import { FirstStepsOverlay } from "./components/FirstStepsOverlay";
import { AdminResolutionBanner } from "./components/AdminResolutionBanner";

const QUESTIONS_PAGE_SIZE = 8;
const DRAFTS_PAGE_SIZE = 6;
const REVIEWED_DRAFTS_STORAGE_KEY = "fv_reviewed_drafts_v1";
const REVIEWED_DRAFT_CHOICES_STORAGE_KEY = "fv_reviewed_draft_choices_v1";
const FEED_SCROLL_ANCHOR_STORAGE_KEY = "fv_feed_scroll_anchor_v1";
const FEED_UI_STATE_STORAGE_KEY = "fv_feed_ui_state_v1";

type FeedScrollAnchor = {
  anchorId: string;
  prevId?: string | null;
  nextId?: string | null;
  offsetTop: number;
  scrollY: number;
  ts: number;
};

type FeedUiState = {
  activeTab: string;
  activeCategory: string | null;
  activeRegion: string | null;
  searchQuery: string;
  guestVotedFilter: "exclude" | "only";
  typeFilter: "all" | "prognose" | "meinung";
  draftStatusFilter: "all" | "open" | "accepted" | "rejected";
  mainView: "all" | "feed" | "review";
  showAnsweredInFeed: boolean;
  ts: number;
};

function readFeedUiStateFromStorage(): Partial<FeedUiState> | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(FEED_UI_STATE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<FeedUiState>;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeFeedUiStateToStorage(state: FeedUiState) {
  try {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(FEED_UI_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

const feedTabs = [
  { id: "all", label: "Alle", icon: "✨" },
  { id: "top", label: "Top heute", icon: "🔥" },
  { id: "trending", label: "Trending", icon: "📈" },
  { id: "new", label: "Neu & unbewertet", icon: "🆕" },
];

function formatDraftTimeLeft(hours: number): string {
  const totalHours = Math.max(0, Math.floor(hours));
  if (totalHours <= 0) return "Abgelaufen";

  if (totalHours < 24) {
    return `${totalHours}h`;
  }

  const totalDays = Math.floor(totalHours / 24);
  const years = Math.floor(totalDays / 365);
  const daysAfterYears = totalDays % 365;
  const months = Math.floor(daysAfterYears / 30);
  const days = daysAfterYears % 30;

  const parts: string[] = [];
  if (years > 0) parts.push(`${years}J`);
  if (months > 0) parts.push(`${months}M`);
  if (days > 0 || parts.length === 0) parts.push(`${days}T`);

  return parts.join(" ");
}

function formatDeadline(date: string) {
  const now = new Date();
  const closes = new Date(date);
  const msLeft = closes.getTime() - now.getTime();
  const days = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));

  if (days === 0) return "Endet heute";
  if (days === 1) return "Endet morgen";
  return `Endet in ${days} Tagen`;
}

function statusBadge(status?: Question["status"]) {
  if (status === "closingSoon") {
    return { label: "Endet bald", className: "bg-amber-500/15 text-amber-200" };
  }
  if (status === "new") {
    return { label: "Neu", className: "bg-emerald-500/15 text-emerald-200" };
  }
  if (status === "trending") {
    return { label: "Trending", className: "bg-rose-500/15 text-rose-100" };
  }
  if (status === "top") {
    return { label: "Top", className: "bg-indigo-500/15 text-indigo-100" };
  }
   if (status === "archived") {
     return { label: "Gestoppt", className: "bg-slate-500/20 text-slate-100" };
   }
  return null;
}

function VoteBar({ yesPct, noPct }: { yesPct: number; noPct: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div
        className="h-full bg-emerald-400 transition-all duration-500 ease-out"
        style={{ width: `${yesPct}%` }}
      />
      <div
        className="absolute right-0 top-0 h-full bg-rose-400 transition-all duration-500 ease-out"
        style={{ width: `${noPct}%` }}
      />
    </div>
  );
}

function getQuestionTitleSizeClass(title: string): string {
  const normalized = title.trim().replace(/\s+/g, " ");
  const len = normalized.length;
  if (len > 140) return "text-base";
  if (len > 95) return "text-lg";
  return "text-xl";
}

function getDraftTitleSizeClass(title: string): string {
  const normalized = title.trim().replace(/\s+/g, " ");
  const len = normalized.length;
  if (len > 120) return "text-base";
  if (len > 85) return "text-[17px]";
  return "text-lg";
}

function FeedCardSkeleton({ variant }: { variant: "question" | "draft" }) {
  return (
    <article
      aria-hidden="true"
      className="relative flex h-full w-full max-w-xl flex-col gap-5 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-black/20 mx-auto animate-pulse"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-white/10" />
          <div className="space-y-2">
            <div className="h-3 w-24 rounded-full bg-white/10" />
            <div className="h-3 w-32 rounded-full bg-white/10" />
          </div>
        </div>
        <div className="h-6 w-24 rounded-full bg-white/10" />
      </div>

      <div className="space-y-2">
        <div className="h-5 w-4/5 rounded-lg bg-white/10" />
        <div className="h-4 w-3/5 rounded-lg bg-white/10" />
      </div>

      <div className="space-y-2">
        <div className="h-2 w-full rounded-full bg-white/10" />
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>{variant === "question" ? "Ja/Nein" : "Gut/Schlecht"}</span>
          <span>Lade...</span>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="h-11 flex-1 rounded-xl bg-white/10" />
        <div className="h-11 flex-1 rounded-xl bg-white/10" />
      </div>
    </article>
  );
}

function EventCard({
  question,
  onVote,
  onVoteOption,
  isSubmitting,
  onOpenDetails,
  showFavorite,
  isFavorited,
  onToggleFavorite,
  isFavoriteSubmitting,
  }: {
  question: Question;
  onVote?: (choice: "yes" | "no") => void;
  onVoteOption?: (optionId: string) => void;
  isSubmitting?: boolean;
  onOpenDetails?: (href: string) => void;
  showFavorite?: boolean;
  isFavorited?: boolean;
  onToggleFavorite?: () => void;
  isFavoriteSubmitting?: boolean;
}) {
  const badge = statusBadge(question.status);
  const answerMode = question.answerMode ?? "binary";
  const isOptions = answerMode === "options";
  const isResolvable = question.isResolvable === true;
  const votedChoice = question.userChoice;
  const voted = isOptions ? Boolean(question.userOptionId) : Boolean(votedChoice);
  const votedTooltip = voted
    ? isOptions
      ? (() => {
          const label = question.options?.find((o) => o.id === question.userOptionId)?.label;
          return label ? `Du hast abgestimmt: ${label}` : "Du hast abgestimmt";
        })()
      : votedChoice === "yes"
        ? "Du hast abgestimmt: Ja"
        : votedChoice === "no"
          ? "Du hast abgestimmt: Nein"
          : "Du hast abgestimmt"
    : null;
  const voteLocked = voted;
  const isClosingSoon = question.status === "closingSoon";
  const hasChoice = votedChoice === "yes" || votedChoice === "no";
  const optionsTotalVotes = isOptions
    ? (question.options ?? []).reduce((sum, opt) => sum + Math.max(0, opt.votesCount ?? 0), 0)
    : 0;
  const optionBars = (question.options ?? []).slice(0, 6);
  const topOptionsLabel = isOptions
    ? (question.options ?? [])
        .slice()
        .sort((a, b) => (b.votesCount ?? 0) - (a.votesCount ?? 0))
        .slice(0, 3)
        .map((opt) => `${opt.label} (${opt.pct ?? 0}%)`)
        .join(" · ")
    : "";

  return (
      <article
        data-feed-item-id={`q:${question.id}`}
        className={`group relative flex h-full w-full max-w-xl flex-col gap-5 rounded-3xl border p-6 shadow-xl transition hover:-translate-y-1 mx-auto ${
          isResolvable
            ? "border-white/[0.156] bg-white/5 shadow-emerald-500/[0.234] hover:border-emerald-300/[0.624] hover:shadow-emerald-400/[0.39]"
            : "border-amber-200/[0.250] bg-[radial-gradient(circle_at_top,rgba(245,158,11,0.09),rgba(2,6,23,0.95)_70%)] shadow-amber-500/[0.125] hover:border-amber-200/[0.283] hover:shadow-amber-400/[0.187]"
      } ${
        voted
          ? isResolvable
            ? "ring-1 ring-emerald-300/25"
            : "ring-1 ring-amber-200/20"
          : ""
      }`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3 text-sm font-semibold text-slate-100">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
            style={{ backgroundColor: `${question.categoryColor}22`, color: question.categoryColor }}
          >
            {question.categoryIcon}
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-[0.2rem] text-slate-300">{question.category}</span>
            <span className="text-sm text-slate-200">{question.summary}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {badge && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          )}
          {votedTooltip ? (
            <span
              title={votedTooltip}
              aria-label={votedTooltip}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-500/15 text-[12px] font-bold text-emerald-50"
            >
              ✓
            </span>
          ) : null}
          {question.status === "trending" && (
            <span className="flex items-center gap-1 text-xs text-rose-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-300" />
              Hot
            </span>
          )}
          {showFavorite && (
            <button
              type="button"
              onClick={(e) => {
                e.currentTarget.blur();
                onToggleFavorite?.();
              }}
              disabled={Boolean(isFavoriteSubmitting)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition hover:-translate-y-0.5 ${
                isFavorited
                  ? "border-amber-200/60 bg-amber-500/15 text-amber-100 shadow-lg shadow-amber-500/20"
                  : "border-white/15 bg-white/5 text-slate-100 hover:border-emerald-200/30"
              } ${isFavoriteSubmitting ? "opacity-70" : ""}`}
              title={isFavorited ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
              aria-label={isFavorited ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill={isFavorited ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 2l3.09 6.63 7.19.61-5.46 4.73L18.18 21 12 17.27 5.82 21l1.64-7.03L2 9.24l7.19-.61L12 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-4">
          <Link
            href={`/questions/${encodeURIComponent(question.id)}`}
            onClick={(e) => {
              if (!onOpenDetails) return;
              e.preventDefault();
              onOpenDetails(`/questions/${encodeURIComponent(question.id)}`);
            }}
            aria-label={`Details öffnen: ${question.title}`}
            className="block flex-shrink-0 no-underline"
          >
            {question.imageUrl ? (
              <div className="inline-flex max-h-24 max-w-[7rem] items-center justify-center overflow-hidden rounded-2xl bg-black/30">
                <img
                  src={question.imageUrl}
                  alt={question.title}
                  className="h-auto w-auto max-h-24 max-w-[7rem] object-contain transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
            ) : (
              <div className="flex h-24 w-[7rem] items-center justify-center overflow-hidden rounded-2xl bg-black/30">
                <div
                  className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/0 text-2xl text-white/60"
                  style={{ backgroundColor: `${question.categoryColor}22`, color: question.categoryColor }}
                  aria-hidden="true"
                >
                  {question.categoryIcon}
                </div>
              </div>
            )}
            {question.imageCredit && (
              <p className="mt-1 text-[10px] leading-tight text-slate-400 line-clamp-2">Bild: {question.imageCredit}</p>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <h3
              className={`card-title-wrap line-clamp-5 font-bold leading-tight text-white ${getQuestionTitleSizeClass(
                question.title
              )}`}
            >
              <Link
                href={`/questions/${encodeURIComponent(question.id)}`}
                onClick={(e) => {
                  if (!onOpenDetails) return;
                  e.preventDefault();
                  onOpenDetails(`/questions/${encodeURIComponent(question.id)}`);
                }}
                aria-label={`Details öffnen: ${question.title}`}
                className="block no-underline"
              >
                {question.title}
              </Link>
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <Link
                href={`/questions/${encodeURIComponent(question.id)}`}
                onClick={(e) => {
                  if (!onOpenDetails) return;
                  e.preventDefault();
                  onOpenDetails(`/questions/${encodeURIComponent(question.id)}`);
                }}
                className="inline-flex min-w-[9.5rem] items-center justify-center rounded-full border border-amber-200/40 bg-amber-500/20 px-5 py-1.5 text-sm font-semibold leading-none text-amber-50 shadow-sm shadow-amber-500/10 transition hover:-translate-y-0.5 hover:border-amber-200/60 hover:bg-amber-500/25"
              >
                Details ansehen
              </Link>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 rounded-2xl bg-black/25 px-4 py-3 text-xs text-slate-200 sm:flex-row sm:items-center sm:justify-between">
          <span
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 ${
              isClosingSoon
                ? "bg-amber-500/20 text-amber-100 border border-amber-300/60"
                : "bg-emerald-500/15 text-emerald-100"
            }`}
          >
            <span className="text-base">⏳</span>
            <span suppressHydrationWarning>{formatDeadline(question.closesAt)}</span>
          </span>
          {!isOptions ? (
            <span className="min-w-0 break-words [overflow-wrap:anywhere] text-slate-200 sm:text-right">
              {`Ja ${question.yesVotes} (${question.yesPct}%) · Nein ${question.noVotes} (${question.noPct}%)`}
            </span>
          ) : null}
        </div>
        {!isOptions ? <VoteBar yesPct={question.yesPct} noPct={question.noPct} /> : null}
      </div>

      {isOptions ? (
        <div className="space-y-1">
          {optionBars.length > 0 ? (
            optionBars.map((opt) => {
              const pct = Math.max(0, Math.min(100, Number(opt.pct ?? 0) || 0));
              const isSelected = question.userOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    if (!voteLocked && !isSubmitting) onVoteOption?.(opt.id);
                  }}
                  disabled={voteLocked || Boolean(isSubmitting)}
                  aria-label={`Option wählen: ${opt.label}`}
                  className={`group flex w-full items-center gap-1.5 rounded-md border p-[2px] text-left transition ${
                    isSelected
                      ? "border-emerald-200/85 bg-emerald-500/20 shadow-[0_0_0_1px_rgba(52,211,153,0.25),0_0_18px_rgba(52,211,153,0.12)]"
                      : "border-white/10 bg-black/10 hover:border-emerald-200/30 hover:bg-white/5"
                  } ${voteLocked ? (isSelected ? "cursor-default" : "cursor-default opacity-60") : ""} ${
                    isSubmitting ? "opacity-70 cursor-wait" : ""
                  }`}
                >
                  <div className="w-8 shrink-0 text-[9px] font-semibold text-slate-200 tabular-nums">{pct}%</div>
                  <div className="relative h-[12px] flex-1 overflow-hidden rounded-[4px] bg-white/5">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-[4px] ${
                        isSelected ? "bg-emerald-300/90" : "bg-emerald-400/35 group-hover:bg-emerald-400/45"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                    <div className="absolute inset-0 flex items-center px-1.5">
                      <span
                        className={`min-w-0 truncate text-[9px] font-semibold leading-none drop-shadow ${
                          isSelected ? "text-white" : "text-slate-100/90"
                        }`}
                      >
                        {opt.label}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <Link
              href={`/questions/${encodeURIComponent(question.id)}`}
              className="card-button yes text-center hover:shadow-[0_0_18px_rgba(52,211,153,0.25)]"
            >
              Zur Umfrage
            </Link>
          )}

        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              if (!voteLocked) onVote?.("yes");
            }}
            disabled={isSubmitting || voteLocked}
            className={`card-button yes ${
              question.userChoice === "yes"
                ? "ring-2 ring-emerald-200/80 border-emerald-200/80 brightness-110 shadow-[0_0_0_2px_rgba(52,211,153,0.32),0_0_46px_rgba(52,211,153,0.62)]"
                : hasChoice
                  ? "opacity-30 saturate-50"
                  : "hover:shadow-[0_0_18px_rgba(52,211,153,0.25)]"
            } ${isSubmitting ? "opacity-70" : ""}`}
          >
            Ja
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              if (!voteLocked) onVote?.("no");
            }}
            disabled={isSubmitting || voteLocked}
            className={`card-button no ${
              question.userChoice === "no"
                ? "ring-2 ring-rose-200/80 border-rose-200/80 brightness-110 shadow-[0_0_0_2px_rgba(248,113,113,0.32),0_0_46px_rgba(248,113,113,0.62)]"
                : hasChoice
                  ? "opacity-30 saturate-50"
                  : "hover:shadow-[0_0_18px_rgba(248,113,113,0.25)]"
            } ${isSubmitting ? "opacity-70" : ""}`}
          >
            Nein
          </button>
        </div>
      )}

    </article>
  );
}

type DraftReviewChoice = "good" | "bad";

function DraftCard({
  draft,
  onVote,
  onAdminAction,
  isSubmitting,
  hasVoted,
  votedChoice,
}: {
  draft: Draft;
  onVote?: (choice: DraftReviewChoice) => void;
  onAdminAction?: (action: "accept" | "reject" | "delete") => void;
  isSubmitting?: boolean;
  hasVoted?: boolean;
  votedChoice?: DraftReviewChoice | null;
}) {
  const total = Math.max(1, draft.votesFor + draft.votesAgainst);
  const yesPct = Math.round((draft.votesFor / total) * 100);
  const noPct = 100 - yesPct;
  const totalReviews = draft.votesFor + draft.votesAgainst;
  const reviewsRemaining = Math.max(0, 5 - totalReviews);
  const lead = Math.abs(draft.votesFor - draft.votesAgainst);
  const leadRemaining = Math.max(0, 2 - lead);
  const thresholdReached = totalReviews >= 5 && lead >= 2;
  const isClosed = draft.status === "accepted" || draft.status === "rejected";
  const disabled = Boolean(isSubmitting || hasVoted || isClosed);
  const hasReviewChoice = votedChoice === "good" || votedChoice === "bad";
  const statusLabel =
    draft.status === "accepted" ? "Angenommen" : draft.status === "rejected" ? "Abgelehnt" : "Offen";
  const statusClass =
    draft.status === "accepted"
      ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/40"
      : draft.status === "rejected"
      ? "bg-rose-500/15 text-rose-100 border border-rose-400/40"
      : "bg-sky-500/15 text-sky-100 border border-sky-400/30";

  return (
    <article className="flex h-full w-full max-w-xl flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-sky-500/15 transition hover:-translate-y-1 hover:border-sky-200/30 mx-auto">
      <div className="flex items-center justify-between text-xs text-slate-200">
        <span className={`rounded-full px-3 py-1 font-semibold ${statusClass}`}>{statusLabel}</span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">
          {formatDraftTimeLeft(draft.timeLeftHours)}
        </span>
      </div>
      <div className="flex gap-3">
        <div className="flex-shrink-0">
          {draft.imageUrl ? (
            <div className="inline-flex max-h-20 max-w-[6rem] items-center justify-center overflow-hidden rounded-2xl bg-black/30">
              <img
                src={draft.imageUrl}
                alt={draft.title}
                className="h-auto w-auto max-h-20 max-w-[6rem] object-contain transition-transform duration-500 hover:scale-105"
                loading="lazy"
              />
            </div>
          ) : (
            <div className="flex h-20 w-[6rem] items-center justify-center overflow-hidden rounded-2xl bg-black/30">
              <div
                className="flex h-full w-full items-center justify-center bg-gradient-to-br from-white/10 to-white/0 text-xl text-white/60"
                aria-hidden="true"
              >
                FV
              </div>
            </div>
          )}
          {draft.imageCredit && (
            <p className="mt-1 text-[10px] leading-tight text-slate-400 line-clamp-2">Bild: {draft.imageCredit}</p>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4
            className={`card-title-wrap line-clamp-5 font-semibold leading-snug text-white ${getDraftTitleSizeClass(
              draft.title
            )}`}
          >
            {draft.title}
          </h4>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-300">{draft.category}</p>
        <ReportButton
          kind="draft"
          itemId={draft.id}
          itemTitle={draft.title}
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold text-slate-100 hover:border-rose-200/40 transition hover:-translate-y-0.5"
          label="Melden"
        />
      </div>
      {draft.answerMode === "options" && (draft.options?.length ?? 0) > 0 ? (
        <div className="space-y-1 rounded-2xl border border-white/10 bg-white/5 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Antwortoptionen</div>
          <div className="space-y-1 text-xs text-slate-200">
            {(draft.options ?? []).slice(0, 6).map((opt) => (
              <div key={opt.id} className="min-w-0 whitespace-normal break-all" title={opt.label}>
                {opt.label}
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {draft.description && (
        <p className="text-xs text-slate-200">
          {draft.description}
        </p>
      )}
      <div className="flex items-center gap-2 text-xs text-slate-200">
        <span className="font-semibold text-emerald-200">{draft.votesFor} Gut ({yesPct}%)</span>
        <span className="text-slate-400">·</span>
        <span className="font-semibold text-rose-200">{draft.votesAgainst} Schlecht ({noPct}%)</span>
      </div>
      <VoteBar yesPct={yesPct} noPct={noPct} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-300">
        <span>
          {reviewsRemaining > 0
            ? `Noch ${reviewsRemaining} Reviews bis mind. 5 (${totalReviews}/5)`
            : `Mindestens 5 Reviews erreicht (${totalReviews}/5)`}
        </span>
        <span>
          {thresholdReached
            ? `Schwelle erreicht (${lead}/2)`
            : leadRemaining > 0
            ? `Noch ${leadRemaining} Vorsprung bis Entscheidung (${lead}/2)`
            : `Vorsprung erreicht (${lead}/2)`}
        </span>
      </div>
      <div className="flex gap-3">
        <button
          type="button"
          className={`card-button yes w-full ${
            votedChoice === "good"
              ? "ring-2 ring-emerald-200/80 border-emerald-200/80 brightness-110 shadow-[0_0_0_2px_rgba(52,211,153,0.32),0_0_46px_rgba(52,211,153,0.62)]"
              : hasReviewChoice
                ? "opacity-30 saturate-50"
                : ""
          }`}
          disabled={disabled}
          onClick={(e) => {
            e.currentTarget.blur();
            if (!disabled) onVote?.("good");
          }}
        >
          Gute Frage
        </button>
        <button
          type="button"
          className={`card-button no w-full ${
            votedChoice === "bad"
              ? "ring-2 ring-rose-200/80 border-rose-200/80 brightness-110 shadow-[0_0_0_2px_rgba(248,113,113,0.32),0_0_46px_rgba(248,113,113,0.62)]"
              : hasReviewChoice
                ? "opacity-30 saturate-50"
                : ""
          }`}
          disabled={disabled}
          onClick={(e) => {
            e.currentTarget.blur();
            if (!disabled) onVote?.("bad");
          }}
        >
          Ablehnen
        </button>
      </div>
      {onAdminAction && (
        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-300">
          <button
            type="button"
            disabled={isSubmitting}
            className="flex-1 rounded-full border border-emerald-400/60 bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-100 hover:bg-emerald-500/25 disabled:opacity-60"
            onClick={() => onAdminAction("accept")}
          >
            Admin: Direkt übernehmen
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            className="flex-1 rounded-full border border-rose-400/60 bg-rose-500/15 px-3 py-1 font-semibold text-rose-100 hover:bg-rose-500/25 disabled:opacity-60"
            onClick={() => onAdminAction("reject")}
          >
            Admin: Sperren
          </button>
          <button
            type="button"
            disabled={isSubmitting}
            className="flex-1 rounded-full border border-slate-500/60 bg-slate-600/20 px-3 py-1 font-semibold text-slate-100 hover:bg-slate-600/30 disabled:opacity-60"
            onClick={() => onAdminAction("delete")}
          >
            Admin: Endgültig löschen
          </button>
        </div>
      )}
    </article>
  );
}

type CurrentUser =
  | { id: string; email: string; displayName: string; role?: "user" | "admin"; defaultRegion?: string | null }
  | null;

type HomeCache = {
  activeTab: string;
  activeCategory: string | null;
  activeRegion: string | null;
  searchQuery: string;
  guestVotedFilter: "exclude" | "only";
  typeFilter: "all" | "prognose" | "meinung";
  draftStatusFilter: "all" | "open" | "accepted" | "rejected";
  mainView: "all" | "feed" | "review";
  showAnsweredInFeed: boolean;
  visibleQuestionCount: number;
  visibleDraftCount: number;
  questions: Question[];
  answeredQuestions: Question[];
  drafts: Draft[];
  questionsCursor: string | null;
  answeredQuestionsCursor: string | null;
  draftsCursor: string | null;
  questionsTotal: number | null;
  answeredQuestionsTotal: number | null;
  draftsTotal: number | null;
  favoriteQuestions: Record<string, boolean>;
  favoritesUpdatedAt: number | null;
};

let homeCache: HomeCache | null = null;

export default function Home() {
  const router = useRouter();
  // Wichtig: Storage (localStorage/sessionStorage) erst nach dem Mount lesen.
  // Sonst kann es bei SSR/Hydration zu Mismatches kommen (Server kennt Storage nicht).
  const initialUiState = useMemo<Partial<FeedUiState>>(() => ({}), []);
  // Merken, ob bereits beim allerersten Render ein Cache existierte (Client-Navigation).
  // Bei einem harten Reload ist das false (dann müssen wir initial Daten laden).
  const hadHomeCacheOnInitRef = useRef<boolean>(Boolean(homeCache));
  const feedReturnSyncAppliedRef = useRef(false);
  const [feedReturnSyncReady, setFeedReturnSyncReady] = useState<boolean>(() => !hadHomeCacheOnInitRef.current);
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [activeTab, setActiveTab] = useState<string>(() => homeCache?.activeTab ?? initialUiState.activeTab ?? "all");
  const [activeCategory, setActiveCategory] = useState<string | null>(
    () => homeCache?.activeCategory ?? (typeof initialUiState.activeCategory === "string" ? initialUiState.activeCategory : null)
  );
  const [activeRegion, setActiveRegion] = useState<string | null>(
    () => homeCache?.activeRegion ?? (typeof initialUiState.activeRegion === "string" ? initialUiState.activeRegion : null)
  );
  const [searchInput, setSearchInput] = useState<string>(() => homeCache?.searchQuery ?? initialUiState.searchQuery ?? "");
  const [searchQuery, setSearchQuery] = useState<string>(() => homeCache?.searchQuery ?? initialUiState.searchQuery ?? "");
  const [guestVotedFilter, setGuestVotedFilter] = useState<HomeCache["guestVotedFilter"]>(
    () => homeCache?.guestVotedFilter ?? (initialUiState.guestVotedFilter === "only" ? "only" : "exclude")
  );
  const [typeFilter, setTypeFilter] = useState<HomeCache["typeFilter"]>(
    () => homeCache?.typeFilter ?? (initialUiState.typeFilter === "prognose" || initialUiState.typeFilter === "meinung" ? initialUiState.typeFilter : "all")
  );
  const [questions, setQuestions] = useState<Question[]>(() => homeCache?.questions ?? []);
  const [answeredQuestions, setAnsweredQuestions] = useState<Question[]>(() => homeCache?.answeredQuestions ?? []);
  const [drafts, setDrafts] = useState<Draft[]>(() => homeCache?.drafts ?? []);
  const [loading, setLoading] = useState(() => !homeCache);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const tabTouchStart = useRef<number | null>(null);
  const categoryTouchStart = useRef<number | null>(null);
  const [draftSubmittingId, setDraftSubmittingId] = useState<string | null>(null);
  const [reviewedDrafts, setReviewedDrafts] = useState<Record<string, boolean>>({});
  const [reviewedDraftChoices, setReviewedDraftChoices] = useState<Record<string, DraftReviewChoice>>({});
  const [pendingDraftChoice, setPendingDraftChoice] = useState<Record<string, DraftReviewChoice>>({});
  const [showExtraCategories, setShowExtraCategories] = useState(false);
  const [showExtraRegions, setShowExtraRegions] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [draftStatusFilter, setDraftStatusFilter] = useState<"all" | "open" | "accepted" | "rejected">("open");
  const [showAnsweredInFeed, setShowAnsweredInFeed] = useState<boolean>(() => homeCache?.showAnsweredInFeed ?? Boolean(initialUiState.showAnsweredInFeed));
  const [visibleQuestionCount, setVisibleQuestionCount] = useState<number>(
    () => (typeof homeCache?.visibleQuestionCount === "number" ? homeCache.visibleQuestionCount : QUESTIONS_PAGE_SIZE)
  );
  const [visibleDraftCount, setVisibleDraftCount] = useState<number>(
    () => (typeof homeCache?.visibleDraftCount === "number" ? homeCache.visibleDraftCount : DRAFTS_PAGE_SIZE)
  );
  const [questionsCursor, setQuestionsCursor] = useState<string | null>(() => homeCache?.questionsCursor ?? null);
  const [answeredQuestionsCursor, setAnsweredQuestionsCursor] = useState<string | null>(
    () => homeCache?.answeredQuestionsCursor ?? null
  );
  const [draftsCursor, setDraftsCursor] = useState<string | null>(() => homeCache?.draftsCursor ?? null);
  const [questionsTotal, setQuestionsTotal] = useState<number | null>(() => homeCache?.questionsTotal ?? null);
  const [answeredQuestionsTotal, setAnsweredQuestionsTotal] = useState<number | null>(
    () => homeCache?.answeredQuestionsTotal ?? null
  );
  const [draftsTotal, setDraftsTotal] = useState<number | null>(() => homeCache?.draftsTotal ?? null);
  const [mainView, setMainView] = useState<"all" | "feed" | "review">(() => {
    const cached = (homeCache as any)?.mainView;
    if (cached === "all" || cached === "feed" || cached === "review") return cached;
    return (homeCache as any)?.showReviewOnly ? "review" : "all";
  });
  const [favoriteQuestions, setFavoriteQuestions] = useState<Record<string, boolean>>(
    () => homeCache?.favoriteQuestions ?? {}
  );
  const [favoritesUpdatedAt, setFavoritesUpdatedAt] = useState<number | null>(() => homeCache?.favoritesUpdatedAt ?? null);
  const pendingScrollAnchorRef = useRef<FeedScrollAnchor | null>(null);
  const scrollRestoreAttemptedRef = useRef(false);
  const [favoriteSubmittingId, setFavoriteSubmittingId] = useState<string | null>(null);
  const questionsEndRef = useRef<HTMLDivElement | null>(null);
  const answeredQuestionsEndRef = useRef<HTMLDivElement | null>(null);
  const draftsEndRef = useRef<HTMLDivElement | null>(null);
  const [loadingMoreQuestions, setLoadingMoreQuestions] = useState(false);
  const [loadingAnsweredQuestions, setLoadingAnsweredQuestions] = useState(false);
  const [loadingMoreAnsweredQuestions, setLoadingMoreAnsweredQuestions] = useState(false);
  const [loadingMoreDrafts, setLoadingMoreDrafts] = useState(false);
  const answeredLoadStateRef = useRef<{ inflight: boolean; loaded: boolean }>({ inflight: false, loaded: false });
  const tabs = useMemo(
    () => [
      ...feedTabs.slice(0, 2),
      { id: "closingSoon", label: "Endet bald", icon: "⏳" },
      ...feedTabs.slice(2),
    ],
    []
  );

  useEffect(() => {
    if (tabs.some((t) => t.id === activeTab)) return;
    setActiveTab("all");
  }, [tabs, activeTab]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileMenuOpen]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileMenuOpen]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, { label: string; icon: string; color: string }>();

    // Basis-Kategorien immer anbieten
    for (const cat of categories) {
      map.set(cat.label, cat);
    }

    const now = Date.now();

    // Nur Kategorien von aktuell laufenden Fragen (Voting noch aktiv)
    for (const q of questions) {
      const closesMs = Date.parse(q.closesAt);
      const isActive = !Number.isNaN(closesMs) ? closesMs >= now : true;
      if (!isActive) continue;
      if (!map.has(q.category)) {
        map.set(q.category, { label: q.category, icon: "?", color: "#64748b" });
      }
    }

    // Und Kategorien von offenen Drafts im Review-Bereich
    for (const d of drafts) {
      const status = d.status ?? "open";
      const isActiveDraft = status === "open" && d.timeLeftHours > 0;
      if (!isActiveDraft) continue;
      if (!map.has(d.category)) {
        map.set(d.category, { label: d.category, icon: "?", color: "#64748b" });
      }
    }

    return Array.from(map.values());
  }, [questions, drafts]);

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    set.add("Global");
    const now = Date.now();
    for (const q of questions) {
      if (!q.region) continue;
      const closesMs = Date.parse(q.closesAt);
      const isActive = !Number.isNaN(closesMs) ? closesMs >= now : true;
      if (isActive) {
        set.add(q.region);
      }
    }
    for (const d of drafts) {
      const status = d.status ?? "open";
      const isActiveDraft = status === "open" && d.timeLeftHours > 0;
      if (isActiveDraft && d.region) {
        set.add(d.region);
      }
    }
    return Array.from(set);
  }, [questions, drafts]);

  const mainRegions = useMemo(() => {
    const base = regionOptions.slice(0, 10);
    // Standard-Region des Nutzers immer in den sichtbaren Buttons halten
    // (nicht unter "..." verstecken)
    const userRegion = currentUser?.defaultRegion;
    if (userRegion && regionOptions.includes(userRegion)) {
      if (!base.includes(userRegion)) {
        return [userRegion, ...base.filter((r) => r !== userRegion)];
      }
    }
    return base;
  }, [regionOptions, currentUser?.defaultRegion]);
  const extraRegions = useMemo(() => regionOptions.slice(10), [regionOptions]);

  const extraCategories = useMemo(
    () => categoryOptions.filter((c) => !categories.some((base) => base.label === c.label)),
    [categoryOptions]
  );

  const canShowAnsweredInFeed = Boolean(currentUser);
  useEffect(() => {
    if (canShowAnsweredInFeed) return;
    if (!showAnsweredInFeed) return;
    setShowAnsweredInFeed(false);
  }, [canShowAnsweredInFeed, showAnsweredInFeed]);

  // Seriosität/UX: abgestimmte Fragen nicht automatisch in den Feed mischen.
  // (Das erzeugt sonst Scroll-Sprünge und wirkt chaotisch.)
  useEffect(() => {
    if (!currentUser) return;
    if (!showAnsweredInFeed) return;
    setShowAnsweredInFeed(false);
  }, [currentUser, showAnsweredInFeed]);

  const resetAnsweredQuestions = useCallback(() => {
    setAnsweredQuestions([]);
    setAnsweredQuestionsCursor(null);
    setAnsweredQuestionsTotal(null);
    answeredLoadStateRef.current = { inflight: false, loaded: false };
  }, []);

  const fetchAnsweredQuestionsFirstPage = useCallback(async () => {
    if (!showAnsweredInFeed) return;
    if (answeredLoadStateRef.current.inflight || answeredLoadStateRef.current.loaded) return;
    answeredLoadStateRef.current.inflight = true;

    setLoadingAnsweredQuestions(true);
    try {
      const params = new URLSearchParams();
      const basePageSize = Math.max(QUESTIONS_PAGE_SIZE, DRAFTS_PAGE_SIZE);
      const pageSize = searchQuery.trim().length >= 2 ? Math.max(basePageSize, 24) : basePageSize;
      params.set("pageSize", String(pageSize));
      params.set("include", "questions");
      params.set("tab", activeTab);
      params.set("voted", "only");
      if (activeCategory) params.set("category", activeCategory);
      if (activeRegion) params.set("region", activeRegion);
      if (searchQuery.trim().length >= 2) params.set("q", searchQuery.trim());

      const res = await fetch(`/api/questions?${params.toString()}`);
      if (!res.ok) return;
      const data = await res.json();
      const initial: Question[] = data.questions ?? [];
      const unique = Array.from(new Map(initial.map((q) => [q.id, q])).values());
      setAnsweredQuestions(unique);
      setAnsweredQuestionsCursor(typeof data.questionsNextCursor === "string" ? data.questionsNextCursor : null);
      setAnsweredQuestionsTotal(typeof data.questionsTotal === "number" ? data.questionsTotal : null);
      answeredLoadStateRef.current.loaded = true;
    } catch {
      // ignore
    } finally {
      setLoadingAnsweredQuestions(false);
      answeredLoadStateRef.current.inflight = false;
    }
  }, [
    activeTab,
    activeCategory,
    activeRegion,
    searchQuery,
    showAnsweredInFeed,
  ]);

  const fetchLatest = useCallback(async () => {
    setLoading(true);
    try {
      const basePageSize = Math.max(QUESTIONS_PAGE_SIZE, DRAFTS_PAGE_SIZE);
      const pageSize = searchQuery.trim().length >= 2 ? Math.max(basePageSize, 24) : basePageSize;

      // Fragen und Drafts getrennt laden, damit beide Listen unabhängig paginiert werden können.
      const questionParams = new URLSearchParams();
      questionParams.set("pageSize", String(pageSize));
      questionParams.set("include", "questions");
      questionParams.set("tab", activeTab);
      questionParams.set("voted", guestVotedFilter);
      if (activeCategory) questionParams.set("category", activeCategory);
      if (activeRegion) questionParams.set("region", activeRegion);
      if (searchQuery.trim().length >= 2) questionParams.set("q", searchQuery.trim());

      const draftParams = new URLSearchParams();
      draftParams.set("pageSize", String(pageSize));
      draftParams.set("include", "drafts");
      // Drafts: "Noch nicht abgestimmt" / "Abgestimmt" soll auch hier funktionieren.
      // Serverseitig wird (gerätebasiert) über fv_session gefiltert.
      draftParams.set("voted", guestVotedFilter);
      if (activeCategory) draftParams.set("category", activeCategory);
      if (activeRegion) draftParams.set("region", activeRegion);
      if (searchQuery.trim().length >= 2) draftParams.set("q", searchQuery.trim());

      const [questionsRes, draftsRes] = await Promise.all([
        fetch(`/api/questions?${questionParams.toString()}`),
        fetch(`/api/questions?${draftParams.toString()}`),
      ]);

      if (!questionsRes.ok) throw new Error("API Response not ok");
      // Drafts sollen den Feed nicht blockieren, falls einmal etwas schiefgeht.
      const draftsOk = draftsRes.ok;

      const [questionsData, draftsData] = await Promise.all([
        questionsRes.json(),
        draftsOk ? draftsRes.json() : Promise.resolve({ drafts: [], draftsNextCursor: null, draftsTotal: null }),
      ]);

      const initialQuestions: Question[] = questionsData.questions ?? [];
      const initialDrafts: Draft[] = draftsData.drafts ?? [];

      // Sicherstellen, dass keine Duplikate entstehen (z.B. nach Filterwechsel)
      const uniqueQuestions = Array.from(
        new Map(initialQuestions.map((q) => [q.id, q])).values(),
      );
      const uniqueDrafts = Array.from(
        new Map(initialDrafts.map((d) => [d.id, d])).values(),
      );

      setQuestions(uniqueQuestions);
      setDrafts(uniqueDrafts);
      setQuestionsCursor(typeof questionsData.questionsNextCursor === "string" ? questionsData.questionsNextCursor : null);
      setDraftsCursor(typeof draftsData.draftsNextCursor === "string" ? draftsData.draftsNextCursor : null);
      setQuestionsTotal(typeof questionsData.questionsTotal === "number" ? questionsData.questionsTotal : null);
      setDraftsTotal(typeof draftsData.draftsTotal === "number" ? draftsData.draftsTotal : null);
      resetAnsweredQuestions();
      setError(null);
      setToast(null);
    } catch {
      setQuestions([]);
      resetAnsweredQuestions();
      setDrafts([]);
      setQuestionsCursor(null);
      setDraftsCursor(null);
      setQuestionsTotal(null);
      setDraftsTotal(null);
      setError("Konnte Daten nicht laden.");
    } finally {
      setLoading(false);
    }
  }, [
    activeTab,
    activeCategory,
    activeRegion,
    searchQuery,
    guestVotedFilter,
    resetAnsweredQuestions,
  ]);

  useEffect(() => {
    if (!showAnsweredInFeed) return;
    if (loading) return;

    const hasOpenQuestionsForCurrentFilters =
      typeFilter === "all"
        ? questions.length > 0
        : questions.some((q) => (q.isResolvable === false ? false : true) === (typeFilter === "prognose"));

    if (hasOpenQuestionsForCurrentFilters) return; // keine Mischung: nur wenn wirklich keine offenen Fragen mehr da sind
    void fetchAnsweredQuestionsFirstPage();
  }, [fetchAnsweredQuestionsFirstPage, loading, questions, showAnsweredInFeed, typeFilter]);

  useEffect(() => {
    homeCache = {
      activeTab,
      activeCategory,
      activeRegion,
      searchQuery,
      guestVotedFilter,
      typeFilter,
      draftStatusFilter,
      mainView,
      showAnsweredInFeed,
      visibleQuestionCount,
      visibleDraftCount,
      questions,
      answeredQuestions,
      drafts,
      questionsCursor,
      answeredQuestionsCursor,
      draftsCursor,
      questionsTotal,
      answeredQuestionsTotal,
      draftsTotal,
      favoriteQuestions,
      favoritesUpdatedAt,
    };
  }, [
    activeTab,
    activeCategory,
    activeRegion,
    searchQuery,
    guestVotedFilter,
    typeFilter,
    draftStatusFilter,
    mainView,
    showAnsweredInFeed,
    visibleQuestionCount,
    visibleDraftCount,
    questions,
    answeredQuestions,
    drafts,
    questionsCursor,
    answeredQuestionsCursor,
    draftsCursor,
    questionsTotal,
    answeredQuestionsTotal,
    draftsTotal,
    favoriteQuestions,
    favoritesUpdatedAt,
  ]);

  useEffect(() => {
    writeFeedUiStateToStorage({
      activeTab,
      activeCategory,
      activeRegion,
      searchQuery,
      guestVotedFilter,
      typeFilter,
      draftStatusFilter,
      mainView,
      showAnsweredInFeed,
      ts: Date.now(),
    });
  }, [
    activeTab,
    activeCategory,
    activeRegion,
    searchQuery,
    guestVotedFilter,
    typeFilter,
    draftStatusFilter,
    mainView,
    showAnsweredInFeed,
  ]);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchKey = useMemo(() => {
    return [activeTab, guestVotedFilter, activeCategory ?? "", activeRegion ?? "", searchQuery, typeFilter].join("|");
  }, [activeTab, activeCategory, activeRegion, guestVotedFilter, searchQuery, typeFilter]);

  const lastFetchKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const cleanup = () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };

    // Wichtig für UX: Wenn wir aus den Details zurückkommen, wollen wir nicht sofort neu laden.
    // Das würde den Feed (und damit auch das Scroll-Restore) "neu sortieren" und wirkt chaotisch.
    const isFirstRun = lastFetchKeyRef.current === null;
    if (isFirstRun) {
      lastFetchKeyRef.current = fetchKey;
      if (hadHomeCacheOnInitRef.current) return cleanup;
    } else if (lastFetchKeyRef.current === fetchKey) {
      return cleanup;
    } else {
      lastFetchKeyRef.current = fetchKey;
    }

    fetchLatest();
    return cleanup;
  }, [fetchKey, fetchLatest]);

  useEffect(() => {
    const FAVORITES_CACHE_TTL_MS = 30_000;
    if (!currentUser?.id) {
      setFavoriteQuestions({});
      setFavoritesUpdatedAt(null);
      return;
    }

    const now = Date.now();
    if (favoritesUpdatedAt && now - favoritesUpdatedAt < FAVORITES_CACHE_TTL_MS) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/favorites", { cache: "no-store" });
        const json: any = await res.json().catch(() => null);
        if (!res.ok) return;
        const ids: unknown = json?.favoriteIds;
        const list = Array.isArray(ids) ? ids : [];
        const next: Record<string, boolean> = {};
        for (const id of list) {
          if (typeof id === "string" && id) next[id] = true;
        }
        if (cancelled) return;
        setFavoriteQuestions(next);
        setFavoritesUpdatedAt(Date.now());
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, favoritesUpdatedAt]);

  const handleToggleFavorite = useCallback(
    async (questionId: string) => {
      if (!currentUser?.id) {
        showToast("Bitte einloggen, um Favoriten zu nutzen.", "error");
        return;
      }
      if (favoriteSubmittingId) return;
      setFavoriteSubmittingId(questionId);
      try {
        const res = await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, action: "toggle" }),
        });
        const data: any = await res.json().catch(() => null);
        if (!res.ok) {
          showToast(data?.error ?? "Konnte Favorit nicht speichern.", "error");
          return;
        }
        const favorited = Boolean(data?.favorited);
        setFavoriteQuestions((prev) => {
          const next = { ...(prev ?? {}) };
          if (favorited) next[questionId] = true;
          else delete next[questionId];
          return next;
        });
        setFavoritesUpdatedAt(Date.now());
        invalidateProfileCaches();
        showToast(favorited ? "Zu Favoriten hinzugefügt." : "Aus Favoriten entfernt.", "success");
      } catch {
        showToast("Konnte Favorit nicht speichern (Netzwerkfehler).", "error");
      } finally {
        setFavoriteSubmittingId(null);
      }
    },
    [currentUser?.id, favoriteSubmittingId, showToast]
  );

  useEffect(() => {
    const next = searchInput.trim();
    if (next === searchQuery) return;
    const t = window.setTimeout(() => setSearchQuery(next), 350);
    return () => window.clearTimeout(t);
  }, [searchInput, searchQuery]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const submitted = params.get("draft");
    if (submitted === "submitted") {
      showToast("Deine Frage wurde eingereicht und erscheint im Review-Bereich.", "success");
      // Wichtig: Nach dem Einreichen kommen wir meist per Client-Navigation zurück auf "/".
      // Dabei kann der Home-Cache greifen und das frische Draft noch nicht enthalten.
      // Deshalb hier einmal aktiv neu laden.
      void fetchLatest();
      window.history.replaceState(null, "", "/");
    }
  }, [fetchLatest, showToast]);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(REVIEWED_DRAFTS_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return;
      setReviewedDrafts(parsed as Record<string, boolean>);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.localStorage.getItem(REVIEWED_DRAFT_CHOICES_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object") return;
      const next: Record<string, DraftReviewChoice> = {};
      for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
        if (value === "good" || value === "bad") {
          next[key] = value;
        }
      }
      setReviewedDraftChoices(next);
    } catch {
      // ignore
    }
  }, []);

  const markDraftReviewed = useCallback((draftId: string) => {
    setReviewedDrafts((prev) => {
      const next = { ...prev, [draftId]: true };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(REVIEWED_DRAFTS_STORAGE_KEY, JSON.stringify(next));
        }
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const rememberDraftChoice = useCallback((draftId: string, choice: DraftReviewChoice) => {
    setReviewedDraftChoices((prev) => {
      const next = { ...prev, [draftId]: choice };
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(REVIEWED_DRAFT_CHOICES_STORAGE_KEY, JSON.stringify(next));
        }
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  useEffect(() => {
    // UI-State (Filter) aus Storage wiederherstellen - aber nur, wenn kein Cache existiert.
    // (Cache wird bei Client-Navigation genutzt, Storage eher beim harten Reload.)
    try {
      if (typeof window === "undefined") return;
      if (hadHomeCacheOnInitRef.current) return;
      const stored = readFeedUiStateFromStorage();
      if (!stored) return;

      if (typeof stored.activeTab === "string") setActiveTab(stored.activeTab);
      if (typeof stored.activeCategory === "string" || stored.activeCategory === null) setActiveCategory(stored.activeCategory ?? null);
      if (typeof stored.activeRegion === "string" || stored.activeRegion === null) setActiveRegion(stored.activeRegion ?? null);
      if (typeof stored.searchQuery === "string") {
        setSearchInput(stored.searchQuery);
        setSearchQuery(stored.searchQuery);
      }
      if (stored.guestVotedFilter === "only" || stored.guestVotedFilter === "exclude") {
        setGuestVotedFilter(stored.guestVotedFilter);
      }
      if (stored.typeFilter === "prognose" || stored.typeFilter === "meinung" || stored.typeFilter === "all") {
        setTypeFilter(stored.typeFilter);
      }
      if (stored.draftStatusFilter === "all" || stored.draftStatusFilter === "open" || stored.draftStatusFilter === "accepted" || stored.draftStatusFilter === "rejected") {
        setDraftStatusFilter(stored.draftStatusFilter);
      }
      if ((stored as any).mainView === "all" || (stored as any).mainView === "feed" || (stored as any).mainView === "review") {
        setMainView((stored as any).mainView);
      } else if (typeof (stored as any).showReviewOnly === "boolean") {
        setMainView((stored as any).showReviewOnly ? "review" : "all");
      }
      if (typeof stored.showAnsweredInFeed === "boolean") setShowAnsweredInFeed(stored.showAnsweredInFeed);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    // Aktuellen User fuer UI (Login-Status) abrufen
    void fetch("/api/auth/me")
      .then((res) => res.json())
      .then((data) => setCurrentUser(data.user ?? null))
      .catch(() => setCurrentUser(null));
  }, []);

  const handleLogout = useCallback(async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      // Ignorieren, UI wird trotzdem auf ausgeloggten Zustand gesetzt
    } finally {
      invalidateProfileCaches();
      setCurrentUser(null);
    }
  }, []);

  const resetFeedFilters = useCallback(() => {
    setActiveTab("all");
    setActiveCategory(null);
    setActiveRegion(null);
    setSearchInput("");
    setSearchQuery("");
    setTypeFilter("all");
  }, []);

  const filteredQuestions = useMemo(() => {
    // Die eigentliche Tab-Logik (Alle, Top, Endet bald, Neu & wenig bewertet,
    // sowie der Abstimmungs-Filter (bereits abgestimmt ausblenden / nur abgestimmt)
    // wird serverseitig in /api/questions und
    // getQuestionsPageFromSupabase umgesetzt. Hier filtern wir nur noch nach
    // Kategorie und Region, falls sich diese ändern.
    let result = questions;

    if (activeCategory) {
      result = result.filter((q) => q.category === activeCategory);
    }
    if (activeRegion) {
      if (activeRegion === "Global") {
        result = result.filter((q) => !q.region || q.region === "Global");
      } else {
        result = result.filter((q) => q.region === activeRegion);
      }
    }

    if (typeFilter !== "all") {
      const wantResolvable = typeFilter === "prognose";
      result = result.filter((q) => (q.isResolvable === false ? false : true) === wantResolvable);
    }

    // Reihenfolge so lassen, wie sie vom Server kommt.
    return result;
  }, [activeCategory, activeRegion, questions, typeFilter]);

  const hasFeedFilters = useMemo(() => {
    const hasSearch = searchQuery.trim().length >= 2;
    return Boolean(activeCategory || activeRegion || hasSearch || typeFilter !== "all" || activeTab !== "all");
  }, [activeCategory, activeRegion, activeTab, searchQuery, typeFilter]);

  const visibleQuestions = useMemo(
    () => filteredQuestions.slice(0, visibleQuestionCount),
    [filteredQuestions, visibleQuestionCount]
  );

  const filteredDrafts = useMemo(() => {
    let result = drafts;
    if (activeCategory) {
      result = result.filter((d) => d.category === activeCategory);
    }
    if (activeRegion) {
      if (activeRegion === "Global") {
        result = result.filter((d) => !d.region || d.region === "Global");
      } else {
        result = result.filter((d) => d.region === activeRegion);
      }
    }
    // Startansicht bewusst simpel: Review-Bereich zeigt nur offene Drafts.
    result = result.filter((d) => (d.status ?? "open") === "open" && (d.timeLeftHours ?? 0) > 0);

    // Reihenfolge so lassen, wie sie vom Server kommt (Cursor-Pagination + Ranking).
    return result;
  }, [activeCategory, activeRegion, drafts, draftStatusFilter]);

  useEffect(() => {
    // Der Filter ist in der UI entfernt; wir halten ihn defensiv auf "open".
    if (draftStatusFilter !== "open") setDraftStatusFilter("open");
  }, [draftStatusFilter]);

  const visibleDrafts = useMemo(
    () => filteredDrafts.slice(0, visibleDraftCount),
    [filteredDrafts, visibleDraftCount]
  );

  const questionVisibilityKey = useMemo(() => {
    return [
      activeTab,
      guestVotedFilter,
      activeCategory ?? "",
      activeRegion ?? "",
      searchQuery,
      typeFilter,
    ].join("|");
  }, [activeTab, activeCategory, activeRegion, guestVotedFilter, searchQuery, typeFilter]);

  const draftVisibilityKey = useMemo(() => {
    return [
      activeTab,
      guestVotedFilter,
      activeCategory ?? "",
      activeRegion ?? "",
      draftStatusFilter,
      searchQuery,
    ].join("|");
  }, [activeTab, activeCategory, activeRegion, draftStatusFilter, guestVotedFilter, searchQuery]);

  const lastQuestionVisibilityKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastQuestionVisibilityKeyRef.current === null) {
      lastQuestionVisibilityKeyRef.current = questionVisibilityKey;
      return;
    }
    if (lastQuestionVisibilityKeyRef.current === questionVisibilityKey) return;
    lastQuestionVisibilityKeyRef.current = questionVisibilityKey;
    setVisibleQuestionCount(QUESTIONS_PAGE_SIZE);
  }, [questionVisibilityKey]);

  const lastDraftVisibilityKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (lastDraftVisibilityKeyRef.current === null) {
      lastDraftVisibilityKeyRef.current = draftVisibilityKey;
      return;
    }
    if (lastDraftVisibilityKeyRef.current === draftVisibilityKey) return;
    lastDraftVisibilityKeyRef.current = draftVisibilityKey;
    setVisibleDraftCount(DRAFTS_PAGE_SIZE);
  }, [draftVisibilityKey]);

  useEffect(() => {
    if (!questionsEndRef.current) return;
    if (typeof IntersectionObserver === "undefined") return;
    const target = questionsEndRef.current;
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry.isIntersecting) return;

      // Erst lokal mehr anzeigen, falls vorhanden
      if (visibleQuestionCount < filteredQuestions.length) {
        setVisibleQuestionCount((prev) =>
          Math.min(prev + QUESTIONS_PAGE_SIZE, filteredQuestions.length)
        );
        return;
      }

      const alreadyLoadedAll =
        !questionsCursor || (questionsTotal !== null && questions.length >= questionsTotal);
      if (alreadyLoadedAll || loadingMoreQuestions || questions.length === 0) {
        return;
      }

      if (!questionsCursor) return;

      setLoadingMoreQuestions(true);
      void (async () => {
        try {
          const params = new URLSearchParams();
          const basePageSize = Math.max(QUESTIONS_PAGE_SIZE, DRAFTS_PAGE_SIZE);
          const pageSize = searchQuery.trim().length >= 2 ? Math.max(basePageSize, 24) : basePageSize;
          params.set("pageSize", String(pageSize));
          params.set("include", "questions");
          if (questionsCursor) params.set("questionsCursor", questionsCursor);
          params.set("tab", activeTab);
          params.set("voted", guestVotedFilter);
          if (activeCategory) params.set("category", activeCategory);
          if (activeRegion) params.set("region", activeRegion);
          if (searchQuery.trim().length >= 2) params.set("q", searchQuery.trim());

          const res = await fetch(`/api/questions?${params.toString()}`);
          if (!res.ok) return;
          const data = await res.json();
          const newQuestions: Question[] = data.questions ?? [];

          setQuestionsCursor(typeof data.questionsNextCursor === "string" ? data.questionsNextCursor : null);
          if (typeof data.questionsTotal === "number") {
            setQuestionsTotal(data.questionsTotal);
          }

          if (newQuestions.length > 0) {
            setQuestions((prev) => {
              const map = new Map<string, Question>();
              for (const q of prev) map.set(q.id, q);
              for (const q of newQuestions) map.set(q.id, q);
              return Array.from(map.values());
            });
}
        } catch {
          // Fehler beim Nachladen ignorieren
        } finally {
          setLoadingMoreQuestions(false);
        }
      })();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [
    activeTab,
    activeCategory,
    activeRegion,
    filteredQuestions.length,
    questions.length,
    questionsCursor,
    questionsTotal,
    visibleQuestionCount,
    loadingMoreQuestions,
    searchQuery,
    currentUser,
    guestVotedFilter,
  ]);

  useEffect(() => {
    if (!answeredQuestionsEndRef.current) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (!showAnsweredInFeed) return;
    if (!answeredQuestionsCursor) return;
    if (loadingMoreAnsweredQuestions) return;

    const target = answeredQuestionsEndRef.current;
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry.isIntersecting) return;
      if (!answeredQuestionsCursor) return;
      if (loadingMoreAnsweredQuestions) return;

      setLoadingMoreAnsweredQuestions(true);
      void (async () => {
        try {
          const params = new URLSearchParams();
          const basePageSize = Math.max(QUESTIONS_PAGE_SIZE, DRAFTS_PAGE_SIZE);
          const pageSize = searchQuery.trim().length >= 2 ? Math.max(basePageSize, 24) : basePageSize;
          params.set("pageSize", String(pageSize));
          params.set("include", "questions");
          params.set("questionsCursor", answeredQuestionsCursor);
          params.set("tab", activeTab);
          params.set("voted", "only");
          if (activeCategory) params.set("category", activeCategory);
          if (activeRegion) params.set("region", activeRegion);
          if (searchQuery.trim().length >= 2) params.set("q", searchQuery.trim());

          const res = await fetch(`/api/questions?${params.toString()}`);
          if (!res.ok) return;
          const data = await res.json();
          const newQuestions: Question[] = data.questions ?? [];
          setAnsweredQuestionsCursor(typeof data.questionsNextCursor === "string" ? data.questionsNextCursor : null);
          if (typeof data.questionsTotal === "number") {
            setAnsweredQuestionsTotal(data.questionsTotal);
          }
          if (newQuestions.length > 0) {
            setAnsweredQuestions((prev) => {
              const map = new Map<string, Question>();
              for (const q of prev) map.set(q.id, q);
              for (const q of newQuestions) map.set(q.id, q);
              return Array.from(map.values());
            });
          }
        } catch {
          // ignore
        } finally {
          setLoadingMoreAnsweredQuestions(false);
        }
      })();
    });

    observer.observe(target);
    return () => observer.disconnect();
  }, [
    activeTab,
    activeCategory,
    activeRegion,
    answeredQuestionsCursor,
    answeredQuestionsEndRef,
    loadingMoreAnsweredQuestions,
    searchQuery,
    showAnsweredInFeed,
  ]);

  useEffect(() => {
    if (!draftsEndRef.current) return;
    if (typeof IntersectionObserver === "undefined") return;
    const target = draftsEndRef.current;
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (!entry.isIntersecting) return;

      if (visibleDraftCount < filteredDrafts.length) {
        setVisibleDraftCount((prev) =>
          Math.min(prev + DRAFTS_PAGE_SIZE, filteredDrafts.length)
        );
        return;
      }

      const alreadyLoadedAll =
        !draftsCursor || (draftsTotal !== null && drafts.length >= draftsTotal);
      if (alreadyLoadedAll || loadingMoreDrafts || drafts.length === 0) {
        return;
      }

      if (!draftsCursor) return;

      setLoadingMoreDrafts(true);
      void (async () => {
        try {
          const params = new URLSearchParams();
          const basePageSize = Math.max(QUESTIONS_PAGE_SIZE, DRAFTS_PAGE_SIZE);
          const pageSize = searchQuery.trim().length >= 2 ? Math.max(basePageSize, 24) : basePageSize;
          params.set("pageSize", String(pageSize));
          params.set("include", "drafts");
          if (draftsCursor) params.set("draftsCursor", draftsCursor);
          params.set("tab", activeTab);
          params.set("voted", guestVotedFilter);
          if (activeCategory) params.set("category", activeCategory);
          if (activeRegion) params.set("region", activeRegion);
          if (searchQuery.trim().length >= 2) params.set("q", searchQuery.trim());

          const res = await fetch(`/api/questions?${params.toString()}`);
          if (!res.ok) return;
          const data = await res.json();
          const newDrafts: Draft[] = data.drafts ?? [];

          setDraftsCursor(typeof data.draftsNextCursor === "string" ? data.draftsNextCursor : null);
          if (typeof data.draftsTotal === "number") {
            setDraftsTotal(data.draftsTotal);
          }

          if (newDrafts.length > 0) {
            setDrafts((prev) => {
              const map = new Map<string, Draft>();
              for (const d of prev) map.set(d.id, d);
              for (const d of newDrafts) map.set(d.id, d);
              return Array.from(map.values());
            });
}
        } catch {
          // Fehler beim Nachladen ignorieren
        } finally {
          setLoadingMoreDrafts(false);
        }
      })();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [
    activeTab,
    activeCategory,
    activeRegion,
    filteredDrafts.length,
    drafts.length,
    draftsCursor,
    draftsTotal,
    visibleDraftCount,
    loadingMoreDrafts,
    searchQuery,
    guestVotedFilter,
  ]);

  const handleVote = useCallback(
    async (questionId: string, choice: "yes" | "no") => {
      const cooldownSeconds = getVoteCooldownRemainingSeconds();
      if (cooldownSeconds > 0) {
        showToast(`Bitte warte ${cooldownSeconds} Sekunde(n), bevor du erneut votest.`, "error");
        return;
      }

      const prevQuestion = questions.find((q) => q.id === questionId) ?? null;
      const prevAnsweredQuestion = answeredQuestions.find((q) => q.id === questionId) ?? null;
      const alreadyVoted = prevQuestion?.userChoice;
      if (alreadyVoted) return;

      setVoteCooldownUntil(Date.now() + FV_VOTE_COOLDOWN_DEFAULT_MS);
      setSubmittingId(questionId);
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, userChoice: choice } : q)));
      setAnsweredQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, userChoice: choice } : q)));
      try {
        const res = await fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, choice }),
        });
        if (res.status === 429) {
          const { retryAfterMs } = (await res.json()) as { retryAfterMs?: number };
          const retry = Math.ceil(((retryAfterMs ?? 1000) as number) / 1000);
          if (prevQuestion) {
            setQuestions((prev) => prev.map((q) => (q.id === questionId ? prevQuestion : q)));
          } else {
            setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, userChoice: undefined } : q)));
          }
          if (prevAnsweredQuestion) {
            setAnsweredQuestions((prev) => prev.map((q) => (q.id === questionId ? prevAnsweredQuestion : q)));
          } else {
            setAnsweredQuestions((prev) =>
              prev.map((q) => (q.id === questionId ? { ...q, userChoice: undefined } : q))
            );
          }
          setVoteCooldownUntil(Date.now() + Math.max(0, retryAfterMs ?? 0));
          setError(`Bitte warte ${retry} Sekunde(n), bevor du erneut votest.`);
          showToast(`Bitte warte ${retry} Sekunde(n), bevor du erneut votest.`, "error");
          return;
        }
        if (!res.ok) throw new Error("Vote failed");
        const data = await res.json();
        const updated = data.question as Question;
        recordFeedVoteDelta({
          kind: "binary",
          questionId,
          choice:
            (updated as any)?.userChoice === "yes" || (updated as any)?.userChoice === "no"
              ? (updated as any).userChoice
              : choice,
        });
        setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, ...updated } : q)));
        setAnsweredQuestions((prev) =>
          prev.map((q) => (q.id === questionId ? { ...q, ...updated } : q))
        );
        invalidateProfileCaches();
        setError(null);
        triggerAhaMicrocopy({ closesAt: (updated as any)?.closesAt ?? null });
        if (data?.alreadyVoted) {
          showToast("Du hast bereits abgestimmt.", "error");
        } else {
          showToast("Deine Stimme wurde gezählt.", "success");
        }
      } catch {
        clearVoteCooldown();
        if (prevQuestion) {
          setQuestions((prev) => prev.map((q) => (q.id === questionId ? prevQuestion : q)));
        } else {
          setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, userChoice: undefined } : q)));
        }
        if (prevAnsweredQuestion) {
          setAnsweredQuestions((prev) => prev.map((q) => (q.id === questionId ? prevAnsweredQuestion : q)));
        } else {
          setAnsweredQuestions((prev) =>
            prev.map((q) => (q.id === questionId ? { ...q, userChoice: undefined } : q))
          );
        }
        setError("Vote fehlgeschlagen. Bitte versuche es erneut.");
        showToast("Vote fehlgeschlagen. Bitte versuche es erneut.", "error");
      } finally {
        setSubmittingId(null);
      }
    },
    [answeredQuestions, questions, showToast]
  );

  const handleVoteOption = useCallback(
    async (questionId: string, optionId: string) => {
      const cooldownSeconds = getVoteCooldownRemainingSeconds();
      if (cooldownSeconds > 0) {
        showToast(`Bitte warte ${cooldownSeconds} Sekunde(n), bevor du erneut votest.`, "error");
        return;
      }

      const prevQuestion = questions.find((q) => q.id === questionId) ?? null;
      const prevAnsweredQuestion = answeredQuestions.find((q) => q.id === questionId) ?? null;
      const alreadyVoted = prevQuestion?.userOptionId;
      if (alreadyVoted) return;

      setVoteCooldownUntil(Date.now() + FV_VOTE_COOLDOWN_DEFAULT_MS);
      setSubmittingId(questionId);
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;
          const nextOptions = (q.options ?? []).map((opt) => ({
            ...opt,
            votesCount: opt.id === optionId ? Math.max(0, opt.votesCount ?? 0) + 1 : Math.max(0, opt.votesCount ?? 0),
          }));
          const total = nextOptions.reduce((sum, opt) => sum + Math.max(0, opt.votesCount ?? 0), 0);
          const denom = Math.max(1, total);
          const withPct = nextOptions.map((opt) => ({
            ...opt,
            pct: Math.round((Math.max(0, opt.votesCount ?? 0) / denom) * 100),
          }));
          return { ...q, userOptionId: optionId, options: withPct };
        })
      );
      setAnsweredQuestions((prev) =>
        prev.map((q) => {
          if (q.id !== questionId) return q;
          const nextOptions = (q.options ?? []).map((opt) => ({
            ...opt,
            votesCount: opt.id === optionId ? Math.max(0, opt.votesCount ?? 0) + 1 : Math.max(0, opt.votesCount ?? 0),
          }));
          const total = nextOptions.reduce((sum, opt) => sum + Math.max(0, opt.votesCount ?? 0), 0);
          const denom = Math.max(1, total);
          const withPct = nextOptions.map((opt) => ({
            ...opt,
            pct: Math.round((Math.max(0, opt.votesCount ?? 0) / denom) * 100),
          }));
          return { ...q, userOptionId: optionId, options: withPct };
        })
      );

      try {
        const res = await fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, optionId }),
        });
        if (res.status === 429) {
          const { retryAfterMs } = (await res.json()) as { retryAfterMs?: number };
          const retry = Math.ceil(((retryAfterMs ?? 1000) as number) / 1000);
          if (prevQuestion) {
            setQuestions((prev) => prev.map((q) => (q.id === questionId ? prevQuestion : q)));
          }
          if (prevAnsweredQuestion) {
            setAnsweredQuestions((prev) => prev.map((q) => (q.id === questionId ? prevAnsweredQuestion : q)));
          }
          setVoteCooldownUntil(Date.now() + Math.max(0, retryAfterMs ?? 0));
          setError(`Bitte warte ${retry} Sekunde(n), bevor du erneut votest.`);
          showToast(`Bitte warte ${retry} Sekunde(n), bevor du erneut votest.`, "error");
          return;
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error ?? "Vote failed");

        const updated = data.question as Question;
        recordFeedVoteDelta({
          kind: "options",
          questionId,
          optionId: typeof (updated as any)?.userOptionId === "string" ? (updated as any).userOptionId : optionId,
        });
        setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, ...updated } : q)));
        setAnsweredQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, ...updated } : q)));
        invalidateProfileCaches();
        setError(null);
        triggerAhaMicrocopy({ closesAt: (updated as any)?.closesAt ?? null });
        if (data?.alreadyVoted) {
          showToast("Du hast bereits abgestimmt.", "error");
        } else {
          showToast("Deine Stimme wurde gezählt.", "success");
        }
      } catch (e: unknown) {
        clearVoteCooldown();
        if (prevQuestion) {
          setQuestions((prev) => prev.map((q) => (q.id === questionId ? prevQuestion : q)));
        }
        if (prevAnsweredQuestion) {
          setAnsweredQuestions((prev) => prev.map((q) => (q.id === questionId ? prevAnsweredQuestion : q)));
        }
        const message = e instanceof Error ? e.message : "Vote fehlgeschlagen. Bitte versuche es erneut.";
        setError(message);
        showToast(message, "error");
      } finally {
        setSubmittingId(null);
      }
    },
    [answeredQuestions, questions, showToast]
  );

  const handleDraftVote = useCallback(
    async (draftId: string, choice: DraftReviewChoice) => {
      if (reviewedDrafts[draftId]) return;

      setDraftSubmittingId(draftId);
      setPendingDraftChoice((prev) => ({ ...prev, [draftId]: choice }));

      try {
        const res = await fetch("/api/drafts/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId, choice }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error ?? "Draft-Review fehlgeschlagen");
        }

        const updated = data.draft as Draft;
        setDrafts((prev) => {
          const patched = prev.map((d) => (d.id === draftId ? updated : d));
          // UX: Wenn wir gerade "Noch nicht abgestimmt" anzeigen, soll der Draft nach dem Review
          // sofort verschwinden (ohne einen kompletten Reload).
          if (guestVotedFilter === "exclude") {
            return patched.filter((d) => d.id !== draftId);
          }
          return patched;
        });
        markDraftReviewed(draftId);
        invalidateProfileCaches();

        if (data?.alreadyVoted) {
          showToast("Du hast diesen Draft bereits bewertet.", "error");
        } else {
          rememberDraftChoice(draftId, choice);
          showToast("Dein Review wurde gespeichert.", "success");
        }
      } catch (e: unknown) {
        const message =
          e instanceof Error && e.message ? e.message : "Draft-Review fehlgeschlagen. Bitte versuche es erneut.";
        setError(message);
        showToast(message, "error");
      } finally {
        setDraftSubmittingId(null);
        setPendingDraftChoice((prev) => {
          const next = { ...prev };
          delete next[draftId];
          return next;
        });
      }
    },
    [guestVotedFilter, markDraftReviewed, rememberDraftChoice, reviewedDrafts, showToast]
  );

  const handleAdminDraftAction = useCallback(
    async (draftId: string, action: "accept" | "reject" | "delete") => {
      if (!currentUser || currentUser.role !== "admin") {
        showToast("Nur Admins können diese Aktion ausführen.", "error");
        return;
      }
      setDraftSubmittingId(draftId);
      try {
        const res = await fetch("/api/admin/drafts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId, action }),
        });
        const data = await res.json();
        if (!res.ok) {
          showToast(data?.error ?? "Admin-Aktion fehlgeschlagen.", "error");
          return;
        }
        const updated = data.draft as Draft;
        if (action === "delete") {
          setDrafts((prev) => prev.filter((d) => d.id !== updated.id));
        } else {
          setDrafts((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
        }
        // Nach Admin-Aktion Serverdaten aktualisieren, damit neue Fragen im Hauptfeed erscheinen
        await fetchLatest();
        if (action === "accept") {
          showToast(
            "Draft wurde von dir als Admin direkt angenommen.",
            "success"
          );
        } else if (action === "reject") {
          showToast("Draft wurde von dir als Admin gesperrt.", "success");
        } else {
          showToast(
            "Draft wurde von dir als Admin endgültig gelöscht (inkl. Bild).",
            "success"
          );
        }
      } catch {
        showToast("Admin-Aktion fehlgeschlagen (Netzwerkfehler).", "error");
      } finally {
        setDraftSubmittingId(null);
      }
    },
    [currentUser, fetchLatest, showToast]
  );

  const tabLabel = tabs.find((t) => t.id === activeTab)?.label ?? "Feed";

  const handleTabTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    tabTouchStart.current = e.touches[0]?.clientX ?? null;
  };
  const handleTabTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (tabTouchStart.current === null) return;
    const delta = e.changedTouches[0]?.clientX - tabTouchStart.current;
    tabTouchStart.current = null;
    if (!delta || Math.abs(delta) < 40) return;
    const currentIndex = tabs.findIndex((t) => t.id === activeTab);
    const nextIndex = delta < 0 ? Math.min(tabs.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
    setActiveTab(tabs[nextIndex].id);
  };

  const handleCategoryTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    categoryTouchStart.current = e.touches[0]?.clientX ?? null;
  };
  const handleCategoryTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (categoryTouchStart.current === null) return;
    const delta = e.changedTouches[0]?.clientX - categoryTouchStart.current;
    categoryTouchStart.current = null;
    if (!delta || Math.abs(delta) < 40) return;
    const order = [null, ...categoryOptions.map((c) => c.label)];
    const currentIndex = order.indexOf(activeCategory ?? null);
    const nextIndex = delta < 0 ? Math.min(order.length - 1, currentIndex + 1) : Math.max(0, currentIndex - 1);
    setActiveCategory(order[nextIndex]);
  };

  const navigateWithTransition = useCallback(
    (href: string) => {
      setIsLeaving(true);
      setTimeout(() => {
        router.push(href);
      }, 190);
    },
    [router]
  );

  const saveFeedUiStateNow = useCallback(() => {
    writeFeedUiStateToStorage({
      activeTab,
      activeCategory,
      activeRegion,
      searchQuery,
      guestVotedFilter,
      typeFilter,
      draftStatusFilter,
      mainView,
      showAnsweredInFeed,
      ts: Date.now(),
    });
  }, [
    activeTab,
    activeCategory,
    activeRegion,
    searchQuery,
    guestVotedFilter,
    typeFilter,
    draftStatusFilter,
    mainView,
    showAnsweredInFeed,
  ]);

  const saveFeedScrollAnchor = useCallback((anchorId: string) => {
    try {
      if (typeof window === "undefined") return;
      if (!anchorId) return;

      const getIdFromEl = (el: Element | null): string | null => {
        const raw = el?.getAttribute?.("data-feed-item-id");
        return raw && typeof raw === "string" ? raw : null;
      };

      const selector =
        typeof (window as any).CSS?.escape === "function"
          ? `[data-feed-item-id="${(window as any).CSS.escape(anchorId)}"]`
          : `[data-feed-item-id="${anchorId.replace(/\"/g, '\\\\\"')}"]`;
      const el = document.querySelector(selector) as HTMLElement | null;
      if (!el) return;
      const rect = el.getBoundingClientRect();

      const items = Array.from(document.querySelectorAll("[data-feed-item-id]"));
      const index = items.findIndex((item) => item === el);
      const prevId = index > 0 ? getIdFromEl(items[index - 1]) : null;
      const nextId = index >= 0 && index < items.length - 1 ? getIdFromEl(items[index + 1]) : null;

      const payload: FeedScrollAnchor = {
        anchorId,
        prevId,
        nextId,
        offsetTop: Math.round(rect.top),
        scrollY: window.scrollY,
        ts: Date.now(),
      };
      window.sessionStorage.setItem(FEED_SCROLL_ANCHOR_STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      const raw = window.sessionStorage.getItem(FEED_SCROLL_ANCHOR_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<FeedScrollAnchor>;
      if (!parsed || typeof parsed.anchorId !== "string") return;
      pendingScrollAnchorRef.current = {
        anchorId: parsed.anchorId,
        prevId: typeof parsed.prevId === "string" ? parsed.prevId : null,
        nextId: typeof parsed.nextId === "string" ? parsed.nextId : null,
        offsetTop: Number(parsed.offsetTop) || 0,
        scrollY: Number(parsed.scrollY) || 0,
        ts: Number(parsed.ts) || Date.now(),
      };
      scrollRestoreAttemptedRef.current = false;
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (feedReturnSyncAppliedRef.current) return;
    feedReturnSyncAppliedRef.current = true;

    if (!hadHomeCacheOnInitRef.current) {
      consumeFeedVoteDeltas();
      setFeedReturnSyncReady(true);
      return;
    }

    const deltas = consumeFeedVoteDeltas();
    const byQuestionId = new Map<string, (typeof deltas)[number]>();
    for (const d of deltas) {
      byQuestionId.set(d.questionId, d);
    }

    const applyDeltas = (items: Question[]) => {
      if (!items || items.length === 0 || byQuestionId.size === 0) return items;
      return items.map((q) => {
        const d = byQuestionId.get(q.id);
        if (!d) return q;
        if (d.kind === "binary") return { ...q, userChoice: d.choice, userOptionId: undefined };
        return { ...q, userOptionId: d.optionId, userChoice: undefined };
      });
    };

    setQuestions((prev) => {
      const patched = applyDeltas(prev);
      if (guestVotedFilter !== "exclude") return patched;
      return patched.filter((q) => !q.userChoice && !q.userOptionId);
    });
    setAnsweredQuestions((prev) => applyDeltas(prev));
    setFeedReturnSyncReady(true);
  }, [guestVotedFilter]);

  useEffect(() => {
    const anchor = pendingScrollAnchorRef.current;
    if (!anchor) return;
    if (!feedReturnSyncReady) return;
    if (loading) return;
    if (scrollRestoreAttemptedRef.current) return;

    const MAX_ANCHOR_AGE_MS = 30 * 60 * 1000;
    if (Date.now() - anchor.ts > MAX_ANCHOR_AGE_MS) {
      pendingScrollAnchorRef.current = null;
      scrollRestoreAttemptedRef.current = true;
      try {
        if (typeof window !== "undefined") window.sessionStorage.removeItem(FEED_SCROLL_ANCHOR_STORAGE_KEY);
      } catch {
        // ignore
      }
      return;
    }

    scrollRestoreAttemptedRef.current = true;

    const cleanup = () => {
      pendingScrollAnchorRef.current = null;
      try {
        if (typeof window !== "undefined") window.sessionStorage.removeItem(FEED_SCROLL_ANCHOR_STORAGE_KEY);
      } catch {
        // ignore
      }
    };

    const run = (attempt: number) => {
      try {
        const selectEl = (id: string): HTMLElement | null => {
          if (!id) return null;
          const selector =
            typeof (window as any).CSS?.escape === "function"
              ? `[data-feed-item-id="${(window as any).CSS.escape(id)}"]`
              : `[data-feed-item-id="${id.replace(/\"/g, '\\\\\"')}"]`;
          return document.querySelector(selector) as HTMLElement | null;
        };

        const candidates = [anchor.anchorId, anchor.prevId ?? null, anchor.nextId ?? null].filter(
          (id): id is string => Boolean(id)
        );
        const picked =
          candidates
            .map((id) => ({ id, el: selectEl(id) }))
            .find((item) => Boolean(item.el)) ?? null;
        const el = picked?.el ?? null;

        if (!el) {
          if (attempt < 6) {
            requestAnimationFrame(() => run(attempt + 1));
            return;
          }
          window.scrollTo({ top: 0, behavior: "auto" });
          cleanup();
          return;
        }

        if ((picked?.id ?? "") === anchor.anchorId) {
          const rect = el.getBoundingClientRect();
          const delta = rect.top - anchor.offsetTop;
          if (Number.isFinite(delta) && Math.abs(delta) > 1) {
            window.scrollBy({ top: delta, behavior: "auto" });
          }
        } else {
          // Wenn der ursprüngliche Anker nicht mehr existiert (z. B. weil er nach dem Zurückkehren
          // aus dem Feed rausgefiltert wurde), springen wir bewusst zur nächstbesten Karte.
          el.scrollIntoView({ block: "start", behavior: "auto" });
          window.scrollBy({ top: -12, behavior: "auto" });
        }

        cleanup();
      } catch {
        // ignore
      }
    };

    requestAnimationFrame(() => requestAnimationFrame(() => run(0)));
  }, [answeredQuestions.length, drafts.length, feedReturnSyncReady, loading, questions.length, showAnsweredInFeed]);

  return (
    <main
      suppressHydrationWarning
      className={`${isLeaving ? "page-leave" : "page-enter"} min-h-screen bg-transparent text-slate-50`}
    >
      <FirstStepsOverlay />
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 lg:px-6">
        <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/10 px-4 py-6 shadow-2xl shadow-emerald-500/10 backdrop-blur sm:px-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-xl text-emerald-100 shadow-lg shadow-emerald-500/40">
                FV
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.3rem] text-emerald-200/80">FUTURE-VOTE</p>
                <h1 className="text-3xl font-semibold leading-tight text-white md:text-4xl">
                  Umfragen &amp; Prognosen, schnell abgestimmt.
                </h1>
                <p className="mt-1 max-w-2xl text-sm font-semibold text-emerald-100/90">
                  Deine Meinung. Deine Prognose. Deine Stimme.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
              {currentUser && (
                <div className="flex items-center gap-2 rounded-xl bg-black/30 px-3 py-2 text-xs text-slate-200">
                  <button
                    type="button"
                    onClick={() => navigateWithTransition("/profil")}
                    className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300/60 hover:text-emerald-50"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/30 text-[11px] text-emerald-50">
                      {(currentUser.displayName || currentUser.email)
                        .split(" ")
                        .filter(Boolean)
                        .map((part) => part[0])
                        .join("")
                        .slice(0, 2)
                        .toUpperCase() || "U"}
                    </span>
                    <span>Eingeloggt als {currentUser.displayName}</span>
                  </button>
                  {currentUser.role === "admin" && (
                    <button
                      type="button"
                      onClick={() => navigateWithTransition("/admin")}
                      className="rounded-full border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100 transition hover:-translate-y-0.5 hover:border-amber-300/80 hover:bg-amber-500/25"
                      aria-label="Admin-Menü"
                      title="Admin-Menü"
                    >
                      Admin
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-full border border-white/25 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300/60 hover:text-emerald-100"
                  >
                    Logout
                  </button>
                </div>
              )}

              {!currentUser && (
                <button
                  type="button"
                  onClick={() => navigateWithTransition("/auth")}
                  className="rounded-xl bg-emerald-500/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500"
                  title="Einloggen oder registrieren"
                >
                  Login / Register
                </button>
              )}

              <div className="hidden">
                <button
                  type="button"
                  className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-white/30 transition hover:-translate-y-0.5 hover:shadow-white/50"
                  onClick={() => {
                    if (!currentUser) {
                      navigateWithTransition("/auth");
                    } else {
                      navigateWithTransition("/drafts/new");
                    }
                  }}
                >
                  Frage stellen
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/25 px-3 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60 sm:px-4"
                  onClick={() => navigateWithTransition("/archiv")}
                >
                  Archiv
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/25 px-3 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60 sm:px-4"
                  onClick={() => navigateWithTransition("/rangliste")}
                >
                  Rangliste
                </button>
                <button
                  type="button"
                  className="rounded-xl border border-white/25 px-3 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60 sm:px-4"
                  onClick={() => navigateWithTransition("/regeln")}
                >
                  Regeln
                </button>
                {!currentUser && (
                  <button
                    type="button"
                    onClick={() => navigateWithTransition("/auth")}
                    className="rounded-xl bg-emerald-500/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500"
                  >
                    Login / Register
                  </button>
                )}
              </div>
            </div>
          </div>

          {currentUser?.role === "admin" ? (
            <AdminResolutionBanner enabled onOpen={() => navigateWithTransition("/admin/resolutions")} />
          ) : null}

          <div className="hidden md:flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              type="button"
              className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-white/30 transition hover:-translate-y-0.5 hover:shadow-white/50"
              onClick={() => {
                if (!currentUser) {
                  navigateWithTransition("/auth");
                } else {
                  navigateWithTransition("/drafts/new");
                }
              }}
              title="Neue Frage vorschlagen (geht zuerst ins Review)"
            >
              Frage stellen
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/25 px-3 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60 sm:px-4"
              onClick={() => navigateWithTransition("/archiv")}
              title="Archiv & Statistiken"
            >
              Archiv
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/25 px-3 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60 sm:px-4"
              onClick={() => navigateWithTransition("/rangliste")}
              title="Rangliste: Wer lag oft richtig?"
            >
              Rangliste
            </button>
            <button
              type="button"
              className="rounded-xl border border-white/25 px-3 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60 sm:px-4"
              onClick={() => navigateWithTransition("/regeln")}
              title="Regeln & Auflösung"
            >
              Regeln
            </button>
            {mainView !== "review" ? (
              <div className="flex items-center rounded-xl border border-white/25 bg-white/5 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("all");
                    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition hover:-translate-y-0.5 ${
                    typeFilter === "all"
                      ? "bg-emerald-500/25 text-white shadow-sm shadow-emerald-500/20"
                      : "text-slate-100 hover:bg-white/5"
                  }`}
                  title="Alle"
                >
                  Alle
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("prognose");
                    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition hover:-translate-y-0.5 ${
                    typeFilter === "prognose"
                      ? "bg-emerald-500/25 text-white shadow-sm shadow-emerald-500/20"
                      : "text-slate-100 hover:bg-white/5"
                  }`}
                  title="Nur Prognosen"
                >
                  Prognosen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTypeFilter("meinung");
                    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition hover:-translate-y-0.5 ${
                    typeFilter === "meinung"
                      ? "bg-emerald-500/25 text-white shadow-sm shadow-emerald-500/20"
                      : "text-slate-100 hover:bg-white/5"
                  }`}
                  title="Nur Meinungs-Umfragen"
                >
                  <span className="hidden sm:inline">Meinungs-Umfragen</span>
                  <span className="sm:hidden">Umfragen</span>
                </button>
              </div>
            ) : null}
          </div>

          <div className="hidden md:block sticky top-3 z-20 -mx-4 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 backdrop-blur md:static md:-mx-0 md:border-0 md:bg-transparent md:p-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[220px]">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/70" aria-hidden="true">
                  ⌕
                </span>
                <input
                  name="search"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Titel suchen…"
                  className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-10 text-sm text-white placeholder:text-slate-400 shadow-sm shadow-black/20 outline-none transition focus:border-emerald-200/40"
                  aria-label="Titel suchen"
                />
                {searchInput.trim().length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setSearchInput("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 hover:border-emerald-200/40 hover:text-white"
                    aria-label="Suche löschen"
                    title="Suche löschen"
                  >
                    ✕
                  </button>
                ) : null}
              </div>
              {searchQuery.trim().length >= 2 ? (
                <span className="rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-50">
                  Suche aktiv
                </span>
              ) : null}
            </div>
            <div
              className="flex gap-2 overflow-x-auto overflow-y-visible py-1 pb-2 text-sm text-slate-100 snap-x snap-mandatory"
              onTouchStart={handleTabTouchStart}
              onTouchEnd={handleTabTouchEnd}
            >
              {tabs.map((tab) => {
                const label =
                  tab.id === "new"
                    ? "Neu & wenig bewertet"
                    : tab.label;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full px-4 py-2 shadow-sm shadow-black/20 backdrop-blur transition snap-center ${
                      activeTab === tab.id
                        ? "border border-emerald-300/60 bg-emerald-500/20 text-white hover:-translate-y-0.5"
                        : "border border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40 hover:-translate-y-0.5"
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span className="font-semibold whitespace-nowrap">{label}</span>
                  </button>
                );
              })}

            </div>

            <div
              className="mt-1 flex gap-2 overflow-x-auto overflow-y-visible py-1 text-sm text-slate-100 snap-x snap-mandatory"
              onTouchStart={handleCategoryTouchStart}
              onTouchEnd={handleCategoryTouchEnd}
            >
              <button
                type="button"
                onClick={() => setActiveCategory(null)}
                className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 shadow-sm shadow-black/20 snap-center transition ${
                  activeCategory === null
                    ? "border-emerald-300/60 bg-emerald-500/20 text-white hover:-translate-y-0.5"
                    : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40 hover:-translate-y-0.5"
                }`}
              >
                <span>Alle Kategorien</span>
              </button>
              {categories.map((cat) => {
                const isActive = activeCategory === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setActiveCategory(isActive ? null : cat.label)}
                    className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 shadow-sm shadow-black/20 snap-center transition ${
                      isActive
                        ? "border-emerald-300/60 bg-emerald-500/25 text-white hover:-translate-y-0.5"
                        : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40 hover:-translate-y-0.5"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
              {extraCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowExtraCategories((open) => !open)}
                  className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm shadow-black/20 snap-center transition ${
                    showExtraCategories
                      ? "border-emerald-300/60 bg-emerald-500/25 text-white hover:-translate-y-0.5"
                      : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40 hover:-translate-y-0.5"
                  }`}
                  aria-label="Weitere Kategorien"
                >
                  <span className="text-lg leading-none">...</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(true)}
          className="fixed bottom-20 right-5 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white shadow-2xl shadow-emerald-500/10 backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-200/40 active:translate-y-0 md:hidden"
          aria-label="Menü & Filter öffnen"
          title="Menü & Filter"
        >
          <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <path
              d="M4 7h16M4 12h16M4 17h16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </button>

        {mobileMenuOpen ? (
          <div
            className="overlay-enter fixed inset-0 z-50 bg-black/55 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              className="overlay-panel absolute bottom-0 left-0 right-0 max-h-[85svh] overflow-y-auto overscroll-contain rounded-t-3xl border border-white/15 bg-slate-950/95 p-5 shadow-2xl shadow-black/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">Menü & Filter</h2>
                  <p className="mt-1 text-xs text-slate-300">Suche, Filter, Region und Schnellzugriffe.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-full border border-white/20 px-3 py-1 text-xs font-semibold text-slate-100 hover:border-emerald-300/60"
                >
                  Schließen
                </button>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <div className="relative">
                    <span
                      className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-300/70"
                      aria-hidden="true"
                    >
                      🔎
                    </span>
                    <input
                      name="search"
                      value={searchInput}
                      onChange={(e) => setSearchInput(e.target.value)}
                      placeholder="Titel suchen…"
                      className="w-full rounded-full border border-white/10 bg-white/5 py-2 pl-9 pr-10 text-sm text-white placeholder:text-slate-400 shadow-sm shadow-black/20 outline-none transition focus:border-emerald-200/40"
                      aria-label="Titel suchen"
                    />
                    {searchInput.trim().length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setSearchInput("")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-slate-200 hover:border-emerald-200/40 hover:text-white"
                        aria-label="Suche löschen"
                        title="Suche löschen"
                      >
                        ×
                      </button>
                    ) : null}
                  </div>
                  {searchQuery.trim().length >= 2 ? (
                    <span className="inline-flex w-fit rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-50">
                      Suche aktiv
                    </span>
                  ) : null}
                </div>

                {mainView !== "review" ? (
                  <div className="space-y-2">
                    <div
                      className="flex gap-2 overflow-x-auto overflow-y-visible py-1 text-sm text-slate-100 snap-x snap-mandatory"
                      onTouchStart={handleTabTouchStart}
                      onTouchEnd={handleTabTouchEnd}
                    >
                      {tabs.map((tab) => {
                        const label =
                          tab.id === "new"
                            ? "Neu & wenig bewertet"
                              : tab.label;
                        return (
                          <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveTab(tab.id)}
                            className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full px-4 py-2 shadow-sm shadow-black/20 backdrop-blur transition snap-center ${
                              activeTab === tab.id
                                ? "border border-emerald-300/60 bg-emerald-500/20 text-white hover:-translate-y-0.5"
                                : "border border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40 hover:-translate-y-0.5"
                            }`}
                          >
                            <span>{tab.icon}</span>
                            <span className="font-semibold whitespace-nowrap">{label}</span>
                          </button>
                        );
                      })}

                    </div>

                    <div className="flex items-center rounded-xl border border-white/25 bg-white/5 p-1">
                      <button
                        type="button"
                        onClick={() => setTypeFilter("all")}
                        className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition hover:-translate-y-0.5 ${
                          typeFilter === "all"
                            ? "bg-emerald-500/25 text-white shadow-sm shadow-emerald-500/20"
                            : "text-slate-100 hover:bg-white/5"
                        }`}
                        title="Alle"
                      >
                        Alle
                      </button>
                      <button
                        type="button"
                        onClick={() => setTypeFilter("prognose")}
                        className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition hover:-translate-y-0.5 ${
                          typeFilter === "prognose"
                            ? "bg-emerald-500/25 text-white shadow-sm shadow-emerald-500/20"
                            : "text-slate-100 hover:bg-white/5"
                        }`}
                        title="Nur Prognosen"
                      >
                        Prognosen
                      </button>
                      <button
                        type="button"
                        onClick={() => setTypeFilter("meinung")}
                        className={`rounded-lg px-3 py-2 text-[12px] font-semibold transition hover:-translate-y-0.5 ${
                          typeFilter === "meinung"
                            ? "bg-emerald-500/25 text-white shadow-sm shadow-emerald-500/20"
                            : "text-slate-100 hover:bg-white/5"
                        }`}
                        title="Nur Meinungs-Umfragen"
                      >
                        Umfragen
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="space-y-2">
                  <div
                    className="flex gap-2 overflow-x-auto overflow-y-visible py-1 text-sm text-slate-100 snap-x snap-mandatory"
                    onTouchStart={handleCategoryTouchStart}
                    onTouchEnd={handleCategoryTouchEnd}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveCategory(null)}
                      className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 shadow-sm shadow-black/20 snap-center transition ${
                        activeCategory === null
                          ? "border-emerald-300/60 bg-emerald-500/20 text-white hover:-translate-y-0.5"
                          : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40 hover:-translate-y-0.5"
                      }`}
                    >
                      <span>Alle Kategorien</span>
                    </button>
                    {categories.map((cat) => {
                      const isActive = activeCategory === cat.label;
                      return (
                        <button
                          key={cat.label}
                          type="button"
                          onClick={() => setActiveCategory(isActive ? null : cat.label)}
                          className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 shadow-sm shadow-black/20 snap-center transition ${
                            isActive
                              ? "border-emerald-300/60 bg-emerald-500/25 text-white hover:-translate-y-0.5"
                              : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40 hover:-translate-y-0.5"
                          }`}
                        >
                          <span>{cat.icon}</span>
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                    {extraCategories.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowExtraCategories((open) => !open)}
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border shadow-sm shadow-black/20 snap-center transition ${
                          showExtraCategories
                            ? "border-emerald-300/60 bg-emerald-500/25 text-white hover:-translate-y-0.5"
                            : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40 hover:-translate-y-0.5"
                        }`}
                        aria-label="Weitere Kategorien"
                      >
                        <span className="text-lg leading-none">…</span>
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
                    <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-slate-300">
                      Region:
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveRegion(null)}
                      className={`rounded-full px-3 py-1 text-xs shadow-sm shadow-black/20 transition hover:-translate-y-0.5 ${
                        !activeRegion
                          ? "bg-emerald-500/25 text-white border border-emerald-300/60"
                          : "bg-white/5 text-slate-100 border border-white/15 hover:border-emerald-300/40"
                      }`}
                    >
                      Alle Regionen
                    </button>
                    {mainRegions.map((region) => {
                      const isActive = activeRegion === region;
                      const isDefault = currentUser?.defaultRegion === region;
                      const baseClasses =
                        "rounded-full px-3 py-1 text-xs shadow-sm shadow-black/20 transition border hover:-translate-y-0.5";

                      let styleClasses: string;
                      if (isActive) {
                        styleClasses = "bg-emerald-500/25 text-white border-emerald-300/60";
                      } else if (isDefault) {
                        styleClasses = "bg-white/5 text-emerald-100 border-emerald-300/60 hover:border-emerald-300/70";
                      } else {
                        styleClasses = "bg-white/5 text-slate-100 border-white/15 hover:border-emerald-300/40";
                      }

                      return (
                        <button
                          key={region}
                          type="button"
                          onClick={() => setActiveRegion(region === activeRegion ? null : region)}
                          className={`${baseClasses} ${styleClasses}`}
                        >
                          {region}
                        </button>
                      );
                    })}
                    {extraRegions.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => setShowExtraRegions(true)}
                        className="rounded-full px-3 py-1 text-xs shadow-sm shadow-black/20 border border-white/20 bg-white/5 text-slate-100 hover:border-emerald-300/40 transition hover:-translate-y-0.5"
                        aria-label="Weitere Regionen"
                      >
                        …
                      </button>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2 border-t border-white/10 pt-4">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="flex-1 min-w-[140px] rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-white/30 transition hover:-translate-y-0.5 hover:shadow-white/50"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        if (!currentUser) {
                          navigateWithTransition("/auth");
                        } else {
                          navigateWithTransition("/drafts/new");
                        }
                      }}
                      title="Neue Frage vorschlagen (geht zuerst ins Review)"
                    >
                      Frage stellen
                    </button>
                    <button
                      type="button"
                      className="flex-1 min-w-[120px] rounded-xl border border-white/25 px-3 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigateWithTransition("/archiv");
                      }}
                      title="Archiv & Statistiken"
                    >
                      Archiv
                    </button>
                    <button
                      type="button"
                      className="flex-1 min-w-[120px] rounded-xl border border-white/25 px-3 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigateWithTransition("/rangliste");
                      }}
                      title="Rangliste: Wer lag oft richtig?"
                    >
                      Rangliste
                    </button>
                    <button
                      type="button"
                      className="flex-1 min-w-[120px] rounded-xl border border-white/25 px-3 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60"
                      onClick={() => {
                        setMobileMenuOpen(false);
                        navigateWithTransition("/regeln");
                      }}
                      title="Regeln & Auflösung"
                    >
                      Regeln
                    </button>
                    {!currentUser ? (
                      <button
                        type="button"
                        onClick={() => {
                          setMobileMenuOpen(false);
                          navigateWithTransition("/auth");
                        }}
                        className="flex-1 min-w-[160px] rounded-xl bg-emerald-500/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500"
                        title="Einloggen oder registrieren"
                      >
                        Login / Register
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        <div className="mt-4 hidden md:flex flex-wrap items-center gap-2 text-xs text-slate-200">
          <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] uppercase tracking-wide text-slate-300">
            Region:
          </span>
          <button
            type="button"
            onClick={() => setActiveRegion(null)}
            className={`rounded-full px-3 py-1 text-xs shadow-sm shadow-black/20 transition hover:-translate-y-0.5 ${
              !activeRegion
                ? "bg-emerald-500/25 text-white border border-emerald-300/60"
                : "bg-white/5 text-slate-100 border border-white/15 hover:border-emerald-300/40"
            }`}
          >
            Alle Regionen
          </button>
          {mainRegions.map((region) => {
            const isActive = activeRegion === region;
            const isDefault = currentUser?.defaultRegion === region;
            const baseClasses =
              "rounded-full px-3 py-1 text-xs shadow-sm shadow-black/20 transition border hover:-translate-y-0.5";

            let styleClasses: string;
            if (isActive) {
              // Aktiver Filter (immer deutlich hervorgehoben)
              styleClasses = "bg-emerald-500/25 text-white border-emerald-300/60";
            } else if (isDefault) {
              // Standard-Region des Nutzers: leicht hervorgehoben, aber kein aktiver Filter
              styleClasses = "bg-white/5 text-emerald-100 border-emerald-300/60 hover:border-emerald-300/70";
            } else {
              styleClasses = "bg-white/5 text-slate-100 border-white/15 hover:border-emerald-300/40";
            }

            return (
              <button
                key={region}
                type="button"
                onClick={() => setActiveRegion(region === activeRegion ? null : region)}
                className={`${baseClasses} ${styleClasses}`}
              >
                {region}
              </button>
            );
          })}
          {extraRegions.length > 0 && (
            <button
              type="button"
              onClick={() => setShowExtraRegions(true)}
              className="rounded-full px-3 py-1 text-xs shadow-sm shadow-black/20 border border-white/20 bg-white/5 text-slate-100 hover:border-emerald-300/40 transition hover:-translate-y-0.5"
              aria-label="Weitere Regionen"
            >
              ...
            </button>
          )}
        </div>

        <section className="sticky top-0 z-30 mt-8">
          <div className="-mx-2 rounded-2xl border border-white/10 bg-slate-950/80 px-2 py-2 shadow-sm shadow-black/30 backdrop-blur-sm sm:px-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
                {mainView === "review" ? (
                  <>
                    <span aria-hidden="true">🗳️</span>
                    <span>Review (Drafts)</span>
                  </>
                ) : (
                  <>
                    <span>{tabs.find((t) => t.id === activeTab)?.icon ?? ""}</span>
                    <span>{tabLabel}</span>
                  </>
                )}
              </h2>

              <div className="flex flex-wrap items-center justify-end gap-2">
                {mainView !== "review" ? (
                  <span className="hidden lg:inline text-sm text-slate-300">Engagement + Freshness + Trust</span>
                ) : null}

                

                

                <div
                  className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-sm shadow-black/20 backdrop-blur"
                  role="group"
                  aria-label="Bereich"
                  title="Zwischen Alle, Feed und Review umschalten"
                >
                  <button
                    type="button"
                    onClick={() => setMainView("all")}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold transition ${
                      mainView === "all" ? "bg-emerald-500/25 text-white" : "text-slate-100 hover:bg-white/5"
                    }`}
                  >
                    <span className="whitespace-nowrap">Alle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMainView("feed")}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold transition ${
                      mainView === "feed" ? "bg-emerald-500/25 text-white" : "text-slate-100 hover:bg-white/5"
                    }`}
                  >
                    <span className="whitespace-nowrap">Feed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMainView("review")}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold transition ${
                      mainView === "review" ? "bg-emerald-500/25 text-white" : "text-slate-100 hover:bg-white/5"
                    }`}
                  >
                    <span className="whitespace-nowrap">Review</span>
                  </button>
                </div>
<div
                  className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-sm shadow-black/20 backdrop-blur"
                  role="group"
                  aria-label="Abstimmungsfilter"
                  title="Wähle, ob du noch offene oder bereits abgestimmte Fragen sehen willst"
                >
                  <button
                    type="button"
                    onClick={() => setGuestVotedFilter("exclude")}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold transition ${
                      guestVotedFilter === "exclude"
                        ? "bg-emerald-500/25 text-white"
                        : "text-slate-100 hover:bg-white/5"
                    }`}
                  >
                    <span aria-hidden="true">⭕</span>
                    <span className="whitespace-nowrap">Noch nicht abgestimmt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuestVotedFilter("only")}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold transition ${
                      guestVotedFilter === "only"
                        ? "bg-emerald-500/25 text-white"
                        : "text-slate-100 hover:bg-white/5"
                    }`}
                  >
                    <span aria-hidden="true">✅</span>
                    <span className="whitespace-nowrap">Abgestimmt</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {mainView !== "review" && (
          <section className="mt-4 space-y-4">
            <div className="hidden">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
                <span>{tabs.find((t) => t.id === activeTab)?.icon ?? ""}</span>
                <span>{tabLabel}</span>
              </h2>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="hidden lg:inline text-sm text-slate-300">Engagement + Freshness + Trust</span>
                <div
                  className="inline-flex overflow-hidden rounded-full border border-white/10 bg-white/5 shadow-sm shadow-black/20 backdrop-blur"
                  role="group"
                  aria-label="Abstimmungsfilter"
                  title="Wähle, ob du noch offene oder bereits abgestimmte Fragen sehen willst"
                >
                  <button
                    type="button"
                    onClick={() => setGuestVotedFilter("exclude")}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold transition ${
                      guestVotedFilter === "exclude"
                        ? "bg-emerald-500/25 text-white"
                        : "text-slate-100 hover:bg-white/5"
                    }`}
                  >
                    <span aria-hidden="true">⭕</span>
                    <span className="whitespace-nowrap">Noch nicht abgestimmt</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setGuestVotedFilter("only")}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold transition ${
                      guestVotedFilter === "only"
                        ? "bg-emerald-500/25 text-white"
                        : "text-slate-100 hover:bg-white/5"
                    }`}
                  >
                    <span aria-hidden="true">✅</span>
                    <span className="whitespace-nowrap">Abgestimmt</span>
                  </button>
                </div>
              </div>
            </div>
            {loading && visibleQuestions.length > 0 && (
              <div className="text-xs text-slate-400">Aktualisiere...</div>
            )}
            {error && <div className="text-sm text-rose-200">{error}</div>}
            <div key={`${activeTab}-${activeCategory ?? "all"}`} className="list-enter grid gap-5 md:grid-cols-2">
              {loading && !error && visibleQuestions.length === 0
                ? Array.from({ length: QUESTIONS_PAGE_SIZE }).map((_, idx) => (
                    <FeedCardSkeleton key={`q-skel-${idx}`} variant="question" />
                  ))
                : visibleQuestions.map((q) => (
                    <EventCard
                      key={q.id}
                      question={q}
                      isSubmitting={submittingId === q.id}
                      showFavorite={Boolean(currentUser)}
                      isFavorited={Boolean(favoriteQuestions[q.id])}
                      isFavoriteSubmitting={favoriteSubmittingId === q.id}
                      onToggleFavorite={() => void handleToggleFavorite(q.id)}
                      onVote={(choice) => handleVote(q.id, choice)}
                       onVoteOption={(optionId) => handleVoteOption(q.id, optionId)}
                       onOpenDetails={(href) => {
                         saveFeedUiStateNow();
                         saveFeedScrollAnchor(`q:${q.id}`);
                         navigateWithTransition(href);
                       }}
                     />
                   ))}
            </div>
            {!loading && !error && visibleQuestions.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-5 text-sm text-slate-200 shadow-xl shadow-black/20">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-lg text-emerald-100 shadow-lg shadow-emerald-500/25">
                    ✓
                  </div>
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-white">
                      {hasFeedFilters
                        ? "Keine offenen Fragen passen zu deinen Filtern."
                        : "Du hast in diesem Feed alles beantwortet."}
                    </div>
                    {hasFeedFilters ? (
                      <p className="mt-1 text-slate-200/90">
                        Tipp: Setze Filter zurück oder wechsle den Tab, um wieder offene Fragen zu finden.
                      </p>
                    ) : currentUser ? (
                      <p className="mt-1 text-slate-200/90">
                        Du kannst oben auf <span className="font-semibold">Abgestimmt</span> umschalten oder deine Abstimmungen im Profil unter{" "}
                        <span className="font-semibold">Deine Aktivität</span> ansehen.
                      </p>
                    ) : (
                      <p className="mt-1 text-slate-200/90">
                        Tippe oben auf <span className="font-semibold">Abgestimmt</span>, um beantwortete Fragen zu sehen - oder
                        registriere dich, damit deine Abstimmungen geräteübergreifend gespeichert sind.
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {hasFeedFilters ? (
                    <button
                      type="button"
                      onClick={() => {
                        setGuestVotedFilter("exclude");
                        resetFeedFilters();
                      }}
                      className="rounded-full border border-emerald-300/60 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-500/15 transition hover:-translate-y-0.5"
                    >
                      Filter zurücksetzen
                    </button>
                  ) : null}

                  {currentUser ? (
                    <button
                      type="button"
                      onClick={() => navigateWithTransition("/profil/aktivitaet?typ=votes_all")}
                      className="rounded-full border border-emerald-300/60 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-500/15 transition hover:-translate-y-0.5"
                    >
                      Meine Abstimmungen
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => navigateWithTransition("/auth")}
                      className="rounded-full border border-emerald-300/60 bg-emerald-500/20 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-emerald-500/15 transition hover:-translate-y-0.5"
                    >
                      Login / Registrieren
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => navigateWithTransition("/archiv")}
                    className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-300/40"
                  >
                    Archiv entdecken
                  </button>

                  <button
                    type="button"
                    onClick={() => navigateWithTransition("/drafts/new")}
                    className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-300/40"
                  >
                    Neue Frage vorschlagen
                  </button>

                  {!currentUser ? (
                    <button
                      type="button"
                      onClick={() => setGuestVotedFilter((prev) => (prev === "exclude" ? "only" : "exclude"))}
                      className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-300/40"
                    >
                      {guestVotedFilter === "exclude" ? "Abgestimmt anzeigen" : "Noch nicht abgestimmt anzeigen"}
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div ref={questionsEndRef} className="h-1" />
          </section>
        )}

          {toast && (
          <div className="toast-enter fixed bottom-4 right-4 z-50 rounded-2xl border border-white/15 bg-slate-900/90 px-4 py-3 shadow-lg shadow-black/40">
            <div
              className={`text-sm font-semibold ${
                toast.type === "success" ? "text-emerald-200" : "text-rose-200"
              }`}
            >
              {toast.message}
            </div>
          </div>
        )}

        {mainView !== "feed" ? (
        <section id="review-section" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
              <span>🗳️</span> <span>Review-Bereich (Drafts)</span>
            </h2>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <span className="hidden sm:inline">Community entscheidet, was live geht</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                Offen
              </span>
            </div>
          </div>
          <div
            key={`drafts-${activeCategory ?? "all"}`}
            className="list-enter grid gap-5 md:grid-cols-2"
          >
            {loading && !error && visibleDrafts.length === 0
              ? Array.from({ length: DRAFTS_PAGE_SIZE }).map((_, idx) => (
                  <FeedCardSkeleton key={`d-skel-${idx}`} variant="draft" />
                ))
               : visibleDrafts.map((draft) => (
                   <DraftCard
                     key={draft.id}
                     draft={draft}
                     onVote={(choice) => handleDraftVote(draft.id, choice)}
                      onAdminAction={
                       currentUser?.role === "admin" ? (action) => handleAdminDraftAction(draft.id, action) : undefined
                      }
                      isSubmitting={draftSubmittingId === draft.id}
                       hasVoted={guestVotedFilter === "only" || Boolean(reviewedDrafts[draft.id])}
                      votedChoice={pendingDraftChoice[draft.id] ?? reviewedDraftChoices[draft.id] ?? null}
                    />
                  ))}
          </div>
          <div ref={draftsEndRef} className="h-1" />
        </section>
        ) : null}

        {mainView !== "review" &&
        Boolean(currentUser) &&
        showAnsweredInFeed &&
        !loading &&
        visibleQuestions.length === 0 &&
        (loadingAnsweredQuestions || answeredQuestions.length > 0) ? (
          <section className="mt-10 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-white sm:text-lg">Abgestimmte Fragen</h3>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                Abgestimmt
              </span>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {loadingAnsweredQuestions && answeredQuestions.length === 0
                ? Array.from({ length: Math.min(QUESTIONS_PAGE_SIZE, 6) }).map((_, idx) => (
                    <FeedCardSkeleton key={`qa-skel-${idx}`} variant="question" />
                  ))
                : answeredQuestions.map((q) => (
                    <EventCard
                      key={`answered-${q.id}`}
                      question={q}
                      isSubmitting={submittingId === q.id}
                      showFavorite={Boolean(currentUser)}
                      isFavorited={Boolean(favoriteQuestions[q.id])}
                      isFavoriteSubmitting={favoriteSubmittingId === q.id}
                      onToggleFavorite={() => void handleToggleFavorite(q.id)}
                      onVote={(choice) => handleVote(q.id, choice)}
                       onVoteOption={(optionId) => handleVoteOption(q.id, optionId)}
                       onOpenDetails={(href) => {
                         saveFeedUiStateNow();
                         saveFeedScrollAnchor(`q:${q.id}`);
                         navigateWithTransition(href);
                       }}
                     />
                   ))}
            </div>
            <div ref={answeredQuestionsEndRef} className="h-1" />
            {loadingMoreAnsweredQuestions ? <div className="text-xs text-slate-400">Lade mehr…</div> : null}
          </section>
        ) : null}
      </div>
      {showExtraCategories && extraCategories.length > 0 && (
        <div
          className="overlay-enter fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowExtraCategories(false)}
        >
          <div
            className="absolute left-1/2 top-24 w-full max-w-sm -translate-x-1/2 rounded-3xl border border-white/15 bg-slate-900/95 p-4 shadow-2xl shadow-black/40"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Weitere Kategorien</h3>
              <button
                type="button"
                className="rounded-full border border-white/20 px-2 py-1 text-xs text-slate-100 hover:border-emerald-300/60"
                onClick={() => setShowExtraCategories(false)}
              >
                Schliessen
              </button>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {extraCategories.map((cat) => {
                const isActive = activeCategory === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => {
                      setActiveCategory(isActive ? null : cat.label);
                      setShowExtraCategories(false);
                    }}
                    className={`flex w-full items-center justify-start gap-2 rounded-xl px-3 py-2 text-left text-xs ${
                      isActive
                        ? "bg-emerald-500/25 text-white"
                        : "bg-white/5 text-slate-100 hover:bg-white/10"
                    }`}
                  >
                    <span>{cat.icon}</span>
                    <span className="truncate">{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
      {showExtraRegions && extraRegions.length > 0 && (
        <div
          className="overlay-enter fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowExtraRegions(false)}
        >
          <div
            className="absolute left-1/2 top-32 w-full max-w-sm -translate-x-1/2 rounded-3xl border border-white/15 bg-slate-900/95 p-4 shadow-2xl shadow-black/40"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-white">Weitere Regionen</h3>
              <button
                type="button"
                className="rounded-full border border-white/20 px-2 py-1 text-xs text-slate-100 hover:border-emerald-300/60"
                onClick={() => setShowExtraRegions(false)}
              >
                Schliessen
              </button>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto pr-1 text-xs">
              {extraRegions.map((region) => {
                const isActive = activeRegion === region;
                return (
                  <button
                    key={region}
                    type="button"
                    onClick={() => {
                      setActiveRegion(isActive ? null : region);
                      setShowExtraRegions(false);
                    }}
                    className={`flex w-full items-center justify-start gap-2 rounded-xl px-3 py-2 text-left ${
                      isActive
                        ? "bg-emerald-500/25 text-white"
                        : "bg-white/5 text-slate-100 hover:bg-white/10"
                    }`}
                  >
                    <span className="truncate">{region}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
