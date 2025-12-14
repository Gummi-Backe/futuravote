"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { categories, type Draft, type Question } from "./data/mock";
import { invalidateProfileCaches } from "./lib/profileCache";

const QUESTIONS_PAGE_SIZE = 8;
const DRAFTS_PAGE_SIZE = 6;
const REVIEWED_DRAFTS_STORAGE_KEY = "fv_reviewed_drafts_v1";
const REVIEWED_DRAFT_CHOICES_STORAGE_KEY = "fv_reviewed_draft_choices_v1";

const feedTabs = [
  { id: "all", label: "Alle", icon: "✨" },
  { id: "top", label: "Top heute", icon: "🔥" },
  { id: "trending", label: "Trending", icon: "📈" },
  { id: "new", label: "Neu & unbewertet", icon: "🆕" },
  { id: "unanswered", label: "Unbeantwortet", icon: "⭕" },
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
  isSubmitting,
  }: {
  question: Question;
  onVote?: (choice: "yes" | "no") => void;
  isSubmitting?: boolean;
  onOpenDetails?: (href: string) => void;
}) {
  const badge = statusBadge(question.status);
  const votedChoice = question.userChoice;
  const voted = Boolean(votedChoice);
  const votedLabel = votedChoice ? (votedChoice === "yes" ? "Abgestimmt: Ja" : "Abgestimmt: Nein") : null;
  const voteLocked = voted;
  const isClosingSoon = question.status === "closingSoon";
  const hasChoice = votedChoice === "yes" || votedChoice === "no";

  return (
    <article
      className={`group relative flex h-full w-full max-w-xl flex-col gap-5 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-emerald-500/15 transition hover:-translate-y-1 hover:border-emerald-300/40 hover:shadow-emerald-400/25 mx-auto ${
        voted ? "border-emerald-300/50 shadow-emerald-400/30" : ""
      } ${
        isClosingSoon ? "border-amber-300/60 shadow-amber-400/30" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 text-sm font-semibold text-slate-100">
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
        <div className="flex items-center gap-2">
          {badge && (
            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          )}
          {votedLabel && (
            <span className="rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-100">
              {votedLabel}
            </span>
          )}
          {question.status === "trending" && (
            <span className="flex items-center gap-1 text-xs text-rose-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-300" />
              Hot
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex gap-4">
          {question.imageUrl && (
            <div className="inline-flex max-h-24 max-w-[7rem] flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black/30">
              <img
                src={question.imageUrl}
                alt={question.title}
                className="h-auto w-auto max-h-24 max-w-[7rem] object-contain transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          )}
          <div className="flex-1">
            <h3 className="card-title-wrap text-xl font-bold leading-tight text-white">{question.title}</h3>
            {question.imageCredit && (
              <p className="mt-1 text-[10px] text-slate-400 line-clamp-1">{question.imageCredit}</p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 text-xs text-slate-200">
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
          <span className="text-slate-200">
            Ja {question.yesVotes} ({question.yesPct}%) · Nein {question.noVotes} ({question.noPct}%)
          </span>
        </div>
        <VoteBar yesPct={question.yesPct} noPct={question.noPct} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => {
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
          onClick={() => {
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

      <div className="flex items-center justify-between text-xs text-slate-300">
        <Link href={`/questions/${question.id}`} className="text-emerald-100 hover:text-emerald-200">
          Details ansehen →
        </Link>
      </div>
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
    <article className="flex w-full max-w-xl flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-sky-500/15 transition hover:-translate-y-1 hover:border-sky-200/30 mx-auto">
      <div className="flex items-center justify-between text-xs text-slate-200">
        <span className={`rounded-full px-3 py-1 font-semibold ${statusClass}`}>{statusLabel}</span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">
          {formatDraftTimeLeft(draft.timeLeftHours)}
        </span>
      </div>
      <div className="flex gap-3">
        {draft.imageUrl && (
          <div className="inline-flex max-h-20 max-w-[6rem] flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black/30">
            <img
              src={draft.imageUrl}
              alt={draft.title}
              className="h-auto w-auto max-h-20 max-w-[6rem] object-contain transition-transform duration-500 hover:scale-105"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1">
          <h4 className="card-title-wrap text-lg font-semibold leading-snug text-white">{draft.title}</h4>
          {draft.imageCredit && (
            <p className="mt-1 text-[10px] text-slate-400 line-clamp-1">{draft.imageCredit}</p>
          )}
        </div>
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-300">{draft.category}</p>
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
          onClick={() => {
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
          onClick={() => {
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
            Admin: Endgueltig loeschen
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
  draftStatusFilter: "all" | "open" | "accepted" | "rejected";
  showReviewOnly: boolean;
  questions: Question[];
  drafts: Draft[];
  questionsCursor: string | null;
  draftsCursor: string | null;
  questionsTotal: number | null;
  draftsTotal: number | null;
};

let homeCache: HomeCache | null = null;

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser>(null);
  const [activeTab, setActiveTab] = useState<string>(() => homeCache?.activeTab ?? "all");
  const [activeCategory, setActiveCategory] = useState<string | null>(() => homeCache?.activeCategory ?? null);
  const [activeRegion, setActiveRegion] = useState<string | null>(() => homeCache?.activeRegion ?? null);
  const [questions, setQuestions] = useState<Question[]>(() => homeCache?.questions ?? []);
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
  const [debugMultiReview, setDebugMultiReview] = useState(false);
  const [showExtraCategories, setShowExtraCategories] = useState(false);
  const [showExtraRegions, setShowExtraRegions] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [draftStatusFilter, setDraftStatusFilter] = useState<"all" | "open" | "accepted" | "rejected">(
    () => homeCache?.draftStatusFilter ?? "open"
  );
  const [visibleQuestionCount, setVisibleQuestionCount] = useState<number>(QUESTIONS_PAGE_SIZE);
  const [visibleDraftCount, setVisibleDraftCount] = useState<number>(DRAFTS_PAGE_SIZE);
  const [questionsCursor, setQuestionsCursor] = useState<string | null>(() => homeCache?.questionsCursor ?? null);
  const [draftsCursor, setDraftsCursor] = useState<string | null>(() => homeCache?.draftsCursor ?? null);
  const [questionsTotal, setQuestionsTotal] = useState<number | null>(() => homeCache?.questionsTotal ?? null);
  const [draftsTotal, setDraftsTotal] = useState<number | null>(() => homeCache?.draftsTotal ?? null);
  const [showReviewOnly, setShowReviewOnly] = useState(() => homeCache?.showReviewOnly ?? false);
  const questionsEndRef = useRef<HTMLDivElement | null>(null);
  const draftsEndRef = useRef<HTMLDivElement | null>(null);
  const [loadingMoreQuestions, setLoadingMoreQuestions] = useState(false);
  const [loadingMoreDrafts, setLoadingMoreDrafts] = useState(false);
  const tabs = useMemo(
    () => [
      ...feedTabs.slice(0, 2),
      { id: "closingSoon", label: "Endet bald", icon: "⏳" },
      ...feedTabs.slice(2),
    ],
    []
  );

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

  const fetchLatest = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("pageSize", String(Math.max(QUESTIONS_PAGE_SIZE, DRAFTS_PAGE_SIZE)));
      params.set("include", "both");
      params.set("tab", activeTab);
      if (activeCategory) params.set("category", activeCategory);
      if (activeRegion) params.set("region", activeRegion);

      const res = await fetch(`/api/questions?${params.toString()}`);
      if (!res.ok) throw new Error("API Response not ok");
      const data = await res.json();

      const initialQuestions: Question[] = data.questions ?? [];
      const initialDrafts: Draft[] = data.drafts ?? [];

      // Sicherstellen, dass keine Duplikate entstehen (z.B. nach Filterwechsel)
      const uniqueQuestions = Array.from(
        new Map(initialQuestions.map((q) => [q.id, q])).values(),
      );
      const uniqueDrafts = Array.from(
        new Map(initialDrafts.map((d) => [d.id, d])).values(),
      );

      setQuestions(uniqueQuestions);
      setDrafts(uniqueDrafts);
      setQuestionsCursor(typeof data.questionsNextCursor === "string" ? data.questionsNextCursor : null);
      setDraftsCursor(typeof data.draftsNextCursor === "string" ? data.draftsNextCursor : null);
      setQuestionsTotal(typeof data.questionsTotal === "number" ? data.questionsTotal : null);
      setDraftsTotal(typeof data.draftsTotal === "number" ? data.draftsTotal : null);
      setError(null);
      setToast(null);
    } catch {
      setQuestions([]);
      setDrafts([]);
      setQuestionsCursor(null);
      setDraftsCursor(null);
      setQuestionsTotal(null);
      setDraftsTotal(null);
      setError("Konnte Daten nicht laden.");
    } finally {
      setLoading(false);
    }
  }, [activeTab, activeCategory, activeRegion]);

  useEffect(() => {
    homeCache = {
      activeTab,
      activeCategory,
      activeRegion,
      draftStatusFilter,
      showReviewOnly,
      questions,
      drafts,
      questionsCursor,
      draftsCursor,
      questionsTotal,
      draftsTotal,
    };
  }, [
    activeTab,
    activeCategory,
    activeRegion,
    draftStatusFilter,
    showReviewOnly,
    questions,
    drafts,
    questionsCursor,
    draftsCursor,
    questionsTotal,
    draftsTotal,
  ]);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setToast({ message, type });
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  }, []);

  useEffect(() => {
    fetchLatest();
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [fetchLatest]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const submitted = params.get("draft");
    if (submitted === "submitted") {
      showToast("Deine Frage wurde eingereicht und erscheint im Review-Bereich.", "success");
      window.history.replaceState(null, "", "/");
    }
  }, [showToast]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "F1") {
        event.preventDefault();
        setDebugMultiReview((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);


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

  const filteredQuestions = useMemo(() => {
    // Die eigentliche Tab-Logik (Alle, Top, Endet bald, Neu & wenig bewertet,
    // Noch nicht abgestimmt) wird serverseitig in /api/questions und
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

    // Reihenfolge so lassen, wie sie vom Server kommt.
    return result;
  }, [activeCategory, activeRegion, questions]);

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
    if (draftStatusFilter !== "all") {
      result = result.filter((d) => (d.status ?? "open") === draftStatusFilter);
    }
    return [...result].sort((a, b) => {
      if (b.votesFor !== a.votesFor) return b.votesFor - a.votesFor;
      return a.timeLeftHours - b.timeLeftHours;
    });
  }, [activeCategory, activeRegion, drafts, draftStatusFilter]);

  const visibleDrafts = useMemo(
    () => filteredDrafts.slice(0, visibleDraftCount),
    [filteredDrafts, visibleDraftCount]
  );

  useEffect(() => {
    setVisibleQuestionCount(Math.min(QUESTIONS_PAGE_SIZE, filteredQuestions.length));
  }, [filteredQuestions.length]);

  useEffect(() => {
    setVisibleDraftCount(Math.min(DRAFTS_PAGE_SIZE, filteredDrafts.length));
  }, [filteredDrafts.length]);

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
          params.set("pageSize", String(Math.max(QUESTIONS_PAGE_SIZE, DRAFTS_PAGE_SIZE)));
          params.set("include", "questions");
          if (questionsCursor) params.set("questionsCursor", questionsCursor);
          params.set("tab", activeTab);
          if (activeCategory) params.set("category", activeCategory);
          if (activeRegion) params.set("region", activeRegion);

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
          params.set("pageSize", String(Math.max(QUESTIONS_PAGE_SIZE, DRAFTS_PAGE_SIZE)));
          params.set("include", "drafts");
          if (draftsCursor) params.set("draftsCursor", draftsCursor);
          params.set("tab", activeTab);
          if (activeCategory) params.set("category", activeCategory);
          if (activeRegion) params.set("region", activeRegion);

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
  ]);

  const handleVote = useCallback(
    async (questionId: string, choice: "yes" | "no") => {
      const alreadyVoted = questions.find((q) => q.id === questionId)?.userChoice;
      if (alreadyVoted) return;

      setSubmittingId(questionId);
      setQuestions((prev) => prev.map((q) => (q.id === questionId ? { ...q, userChoice: choice } : q)));
      try {
        const res = await fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questionId, choice }),
        });
        if (res.status === 429) {
          const { retryAfterMs } = (await res.json()) as { retryAfterMs?: number };
          const retry = Math.ceil(((retryAfterMs ?? 1000) as number) / 1000);
          setError(`Bitte warte ${retry} Sekunde(n), bevor du erneut votest.`);
          showToast(`Bitte warte ${retry} Sekunde(n), bevor du erneut votest.`, "error");
          return;
        }
        if (!res.ok) throw new Error("Vote failed");
        const data = await res.json();
        const updated = data.question as Question;
        setQuestions((prev) =>
          prev.map((q) => (q.id === questionId ? { ...q, ...updated, userChoice: choice } : q))
        );
        invalidateProfileCaches();
        setError(null);
        showToast("Deine Stimme wurde gezählt.", "success");
      } catch {
        setError("Vote fehlgeschlagen. Bitte versuche es erneut.");
        showToast("Vote fehlgeschlagen. Bitte versuche es erneut.", "error");
        await fetchLatest();
      } finally {
        setSubmittingId(null);
      }
    },
    [fetchLatest, questions, showToast]
  );

  const handleDraftVote = useCallback(
    async (draftId: string, choice: DraftReviewChoice) => {
      if (!debugMultiReview && reviewedDrafts[draftId]) return;

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
        setDrafts((prev) => prev.map((d) => (d.id === draftId ? updated : d)));
        markDraftReviewed(draftId);
        invalidateProfileCaches();

        if (data?.alreadyVoted) {
          showToast("Du hast diesen Draft bereits bewertet.", "error");
        } else {
          rememberDraftChoice(draftId, choice);
          showToast("Dein Review wurde gespeichert.", "success");
        }

        await fetchLatest();
      } catch {
        setError("Draft-Review fehlgeschlagen. Bitte versuche es erneut.");
        showToast("Draft-Review fehlgeschlagen. Bitte versuche es erneut.", "error");
        await fetchLatest();
      } finally {
        setDraftSubmittingId(null);
        setPendingDraftChoice((prev) => {
          const next = { ...prev };
          delete next[draftId];
          return next;
        });
      }
    },
    [debugMultiReview, fetchLatest, markDraftReviewed, rememberDraftChoice, reviewedDrafts, showToast]
  );

  const handleAdminDraftAction = useCallback(
    async (draftId: string, action: "accept" | "reject" | "delete") => {
      if (!currentUser || currentUser.role !== "admin") {
        showToast("Nur Admins koennen diese Aktion ausfuehren.", "error");
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
            "Draft wurde von dir als Admin endgueltig geloescht (inkl. Bild).",
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

  return (
    <main
      suppressHydrationWarning
      className={`${isLeaving ? "page-leave" : "page-enter"} min-h-screen bg-transparent text-slate-50`}
    >
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 lg:px-6">
        {debugMultiReview && (
          <div className="mb-2 rounded-full border border-amber-400/60 bg-amber-500/15 px-4 py-1 text-xs text-amber-100 shadow-sm shadow-amber-500/30">
            Testmodus aktiv: Mehrfach-Reviews fuer Drafts erlaubt (F1 zum Deaktivieren).
          </div>
        )}
        <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/10 px-4 py-6 shadow-2xl shadow-emerald-500/10 backdrop-blur sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-xl text-emerald-100 shadow-lg shadow-emerald-500/40">
                FV
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3rem] text-emerald-200/80">FUTURE-VOTE</p>
                <h1 className="text-3xl font-semibold leading-tight text-white md:text-4xl">Prognosen, schnell abgestimmt.</h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-200">
                  Ja/Nein-Kacheln, Community-Review für neue Fragen, Ranking nach Engagement und Freshness.
                </p>
              </div>
            </div>
            <div className="flex flex-1 flex-col items-end gap-2">
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
                    <span className="rounded-full border border-amber-400/60 bg-amber-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-100">
                      Admin
                    </span>
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

              <div className="flex flex-wrap items-center justify-end gap-3">
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
                  className="rounded-xl border border-white/25 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60"
                  onClick={() => {
                    setShowReviewOnly((prev) => !prev);
                    if (typeof window !== "undefined") {
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }
                  }}
                >
                {showReviewOnly ? "Zurück zum Feed" : "Review"}
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

          <div className="sticky top-3 z-20 -mx-4 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 backdrop-blur md:static md:-mx-0 md:border-0 md:bg-transparent md:p-0">
            <div
              className="flex gap-2 overflow-x-auto overflow-y-visible py-1 pb-2 text-sm text-slate-100 snap-x snap-mandatory"
              onTouchStart={handleTabTouchStart}
              onTouchEnd={handleTabTouchEnd}
            >
              {tabs.map((tab) => {
                const label =
                  tab.id === "new"
                    ? "Neu & wenig bewertet"
                    : tab.id === "unanswered"
                    ? "Noch nicht abgestimmt"
                    : tab.label;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full px-4 py-2 shadow-sm shadow-black/20 backdrop-blur transition snap-center ${
                      activeTab === tab.id
                        ? "bg-white/20 border border-white/30 text-white hover:border-emerald-300/60 hover:-translate-y-0.5"
                        : "bg-white/10 border border-white/15 text-slate-200 hover:border-emerald-300/40 hover:-translate-y-0.5"
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

        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-200">
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

        {!showReviewOnly && (
          <section className="mt-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
                <span>{tabs.find((t) => t.id === activeTab)?.icon ?? ""}</span>
                <span>{tabLabel}</span>
              </h2>
              <span className="text-sm text-slate-300">Engagement + Freshness + Trust</span>
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
                      onVote={(choice) => handleVote(q.id, choice)}
                      onOpenDetails={(href) => navigateWithTransition(href)}
                    />
                  ))}
            </div>
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

        <section id="review-section" className="mt-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
              <span>🗳️</span> <span>Review-Bereich (Drafts)</span>
            </h2>
            <div className="flex items-center gap-3 text-sm text-slate-300">
              <span className="hidden sm:inline">Community entscheidet, was live geht</span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                {([
                  { id: "open" as const, label: "Offen", active: "border-sky-300/60 bg-sky-500/20 text-white" },
                  { id: "accepted" as const, label: "Angenommen", active: "border-emerald-300/60 bg-emerald-500/20 text-white" },
                  { id: "rejected" as const, label: "Abgelehnt", active: "border-rose-300/60 bg-rose-500/20 text-white" },
                  { id: "all" as const, label: "Alle", active: "border-slate-300/30 bg-slate-500/20 text-white" },
                ] as const).map((item) => {
                  const isActive = draftStatusFilter === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setDraftStatusFilter(item.id)}
                      className={`inline-flex min-w-fit items-center justify-center rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition hover:-translate-y-0.5 ${
                        isActive
                          ? item.active
                          : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/40"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
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
                     hasVoted={Boolean(reviewedDrafts[draft.id]) && !debugMultiReview}
                     votedChoice={pendingDraftChoice[draft.id] ?? reviewedDraftChoices[draft.id] ?? null}
                   />
                 ))}
          </div>
          <div ref={draftsEndRef} className="h-1" />
        </section>
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
