"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  allQuestions as initialQuestions,
  categories,
  draftQueue as initialDrafts,
  type Draft,
  type Question,
} from "./data/mock";

const QUESTIONS_PAGE_SIZE = 8;
const DRAFTS_PAGE_SIZE = 6;

const feedTabs = [
  { id: "all", label: "Alle", icon: "✨" },
  { id: "top", label: "Top heute", icon: "🔥" },
  { id: "trending", label: "Trending", icon: "📈" },
  { id: "new", label: "Neu & unbewertet", icon: "🆕" },
  { id: "unanswered", label: "Unbeantwortet", icon: "⭕" },
];

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

  return (
    <article
      className={`group relative flex h-full flex-col gap-5 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-emerald-500/10 transition hover:-translate-y-1 hover:border-emerald-300/40 hover:shadow-emerald-400/25 ${
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
            <div className="flex w-28 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black/30">
              <img
                src={question.imageUrl}
                alt={question.title}
                className="max-h-24 max-w-[7rem] object-contain transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-xl font-bold leading-tight text-white">{question.title}</h3>
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
            Ja {question.yesPct}% · Nein {question.noPct}%
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
            question.userChoice === "yes" ? "ring-2 ring-emerald-200" : "hover:shadow-emerald-400/40"
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
            question.userChoice === "no" ? "ring-2 ring-rose-200" : "hover:shadow-rose-400/40"
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
  isSubmitting,
  hasVoted,
}: {
  draft: Draft;
  onVote?: (choice: DraftReviewChoice) => void;
  isSubmitting?: boolean;
  hasVoted?: boolean;
}) {
  const total = Math.max(1, draft.votesFor + draft.votesAgainst);
  const yesPct = Math.round((draft.votesFor / total) * 100);
  const noPct = 100 - yesPct;
  const isClosed = draft.status === "accepted" || draft.status === "rejected";
  const disabled = Boolean(isSubmitting || hasVoted || isClosed);
  const statusLabel =
    draft.status === "accepted" ? "Angenommen" : draft.status === "rejected" ? "Abgelehnt" : "Offen";
  const statusClass =
    draft.status === "accepted"
      ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/40"
      : draft.status === "rejected"
      ? "bg-rose-500/15 text-rose-100 border border-rose-400/40"
      : "bg-sky-500/15 text-sky-100 border border-sky-400/30";

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-sky-500/15 transition hover:-translate-y-1 hover:border-sky-200/30">
      <div className="flex items-center justify-between text-xs text-slate-200">
        <span className={`rounded-full px-3 py-1 font-semibold ${statusClass}`}>{statusLabel}</span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">{draft.timeLeftHours}h</span>
      </div>
      <div className="flex gap-3">
        {draft.imageUrl && (
          <div className="flex w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black/30">
            <img
              src={draft.imageUrl}
              alt={draft.title}
              className="max-h-20 max-w-[6rem] object-contain transition-transform duration-500 hover:scale-105"
              loading="lazy"
            />
          </div>
        )}
        <div className="flex-1">
          <h4 className="text-lg font-semibold leading-snug text-white">{draft.title}</h4>
        </div>
      </div>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-300">{draft.category}</p>
      {draft.description && (
        <p className="text-xs text-slate-200">
          {draft.description}
        </p>
      )}
      <div className="flex items-center gap-2 text-xs text-slate-200">
        <span className="font-semibold text-emerald-200">{yesPct}% gute Frage</span>
        <span className="text-slate-400">·</span>
        <span className="font-semibold text-rose-200">{noPct}% ablehnen</span>
      </div>
      <VoteBar yesPct={yesPct} noPct={noPct} />
      <div className="flex gap-3">
        <button
          type="button"
          className="card-button yes w-full"
          disabled={disabled}
          onClick={() => {
            if (!disabled) onVote?.("good");
          }}
        >
          Gute Frage
        </button>
        <button
          type="button"
          className="card-button no w-full"
          disabled={disabled}
          onClick={() => {
            if (!disabled) onVote?.("bad");
          }}
        >
          Ablehnen
        </button>
      </div>
    </article>
  );
}

export default function Home() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string; displayName: string } | null>(null);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const toastTimer = useRef<NodeJS.Timeout | null>(null);
  const [submittingId, setSubmittingId] = useState<string | null>(null);
  const tabTouchStart = useRef<number | null>(null);
  const categoryTouchStart = useRef<number | null>(null);
  const [draftSubmittingId, setDraftSubmittingId] = useState<string | null>(null);
  const [reviewedDrafts, setReviewedDrafts] = useState<Record<string, boolean>>({});
  const [debugMultiReview, setDebugMultiReview] = useState(false);
  const [showExtraCategories, setShowExtraCategories] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [draftStatusFilter, setDraftStatusFilter] = useState<"all" | "open" | "accepted" | "rejected">("open");
  const [visibleQuestionCount, setVisibleQuestionCount] = useState<number>(QUESTIONS_PAGE_SIZE);
  const [visibleDraftCount, setVisibleDraftCount] = useState<number>(DRAFTS_PAGE_SIZE);
  const questionsEndRef = useRef<HTMLDivElement | null>(null);
  const draftsEndRef = useRef<HTMLDivElement | null>(null);
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
    for (const cat of categories) {
      map.set(cat.label, cat);
    }
    for (const q of questions) {
      if (!map.has(q.category)) {
        map.set(q.category, { label: q.category, icon: "?", color: "#64748b" });
      }
    }
    for (const d of drafts) {
      const status = d.status ?? "open";
      if (status === "rejected") continue;
      if (!map.has(d.category)) {
        map.set(d.category, { label: d.category, icon: "?", color: "#64748b" });
      }
    }
    return Array.from(map.values());
  }, [questions, drafts]);

  const regionOptions = useMemo(() => {
    const set = new Set<string>();
    set.add("Global");
    for (const q of questions) {
      if (q.region) set.add(q.region);
    }
    for (const d of drafts) {
      if (d.region && (d.status ?? "open") !== "rejected") {
        set.add(d.region);
      }
    }
    return Array.from(set);
  }, [questions, drafts]);

  const extraCategories = useMemo(
    () => categoryOptions.filter((c) => !categories.some((base) => base.label === c.label)),
    [categoryOptions]
  );

  const fetchLatest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/questions");
      if (!res.ok) throw new Error("API Response not ok");
      const data = await res.json();
      setQuestions(data.questions ?? initialQuestions);
      setDrafts(data.drafts ?? initialDrafts);
      setError(null);
      setToast(null);
    } catch {
      setQuestions(initialQuestions);
      setDrafts(initialDrafts);
      setError("Konnte Daten nicht laden (zeige Mock-Daten).");
    } finally {
      setLoading(false);
    }
  }, []);

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
      setCurrentUser(null);
    }
  }, []);

  const filteredQuestions = useMemo(() => {
    let result = questions;
    if (activeTab === "trending") result = result.filter((q) => q.status === "trending");
    else if (activeTab === "new") result = result.filter((q) => q.status === "new");
    else if (activeTab === "unanswered") result = result.filter((q) => !q.userChoice);
    else if (activeTab === "top") result = result.filter((q) => q.status === "top" || q.status === "closingSoon");

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
    const sorted = [...result];

    if (activeTab === "new") {
      sorted.sort((a, b) => {
        const aTime = a.createdAt ? Date.parse(a.createdAt) : 0;
        const bTime = b.createdAt ? Date.parse(b.createdAt) : 0;
        return bTime - aTime;
      });
    } else if (activeTab === "closingSoon") {
      sorted.sort((a, b) => {
        const aTime = Date.parse(a.closesAt);
        const bTime = Date.parse(b.closesAt);
        return aTime - bTime;
      });
    } else {
      sorted.sort((a, b) => {
        const aScore = typeof a.rankingScore === "number" ? a.rankingScore : 0;
        const bScore = typeof b.rankingScore === "number" ? b.rankingScore : 0;
        return bScore - aScore;
      });
    }

    return sorted;
  }, [activeTab, activeCategory, activeRegion, questions]);

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
    if (!questionsEndRef.current || filteredQuestions.length <= QUESTIONS_PAGE_SIZE) return;
    if (typeof IntersectionObserver === "undefined") return;
    const target = questionsEndRef.current;
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        setVisibleQuestionCount((prev) =>
          Math.min(prev + QUESTIONS_PAGE_SIZE, filteredQuestions.length)
        );
      }
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredQuestions.length]);

  useEffect(() => {
    if (!draftsEndRef.current || filteredDrafts.length <= DRAFTS_PAGE_SIZE) return;
    if (typeof IntersectionObserver === "undefined") return;
    const target = draftsEndRef.current;
    const observer = new IntersectionObserver((entries) => {
      const [entry] = entries;
      if (entry.isIntersecting) {
        setVisibleDraftCount((prev) =>
          Math.min(prev + DRAFTS_PAGE_SIZE, filteredDrafts.length)
        );
      }
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [filteredDrafts.length]);

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
      setDrafts((prev) =>
        prev.map((d) =>
          d.id === draftId
            ? {
                ...d,
                votesFor: choice === "good" ? d.votesFor + 1 : d.votesFor,
                votesAgainst: choice === "bad" ? d.votesAgainst + 1 : d.votesAgainst,
              }
            : d
        )
      );

      try {
        const res = await fetch("/api/drafts/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ draftId, choice }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error ?? "Draft-Review fehlgeschlagen");
        }
        const updated = data.draft as Draft;
        setDrafts((prev) => prev.map((d) => (d.id === draftId ? updated : d)));
        setReviewedDrafts((prev) => ({ ...prev, [draftId]: true }));
        showToast("Dein Review wurde gespeichert.", "success");
        await fetchLatest();
      } catch {
        setError("Draft-Review fehlgeschlagen. Bitte versuche es erneut.");
        showToast("Draft-Review fehlgeschlagen. Bitte versuche es erneut.", "error");
        await fetchLatest();
      } finally {
        setDraftSubmittingId(null);
      }
    },
    [debugMultiReview, fetchLatest, reviewedDrafts, showToast]
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
        <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/10 px-6 py-6 shadow-2xl shadow-emerald-500/10 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
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
            <div className="flex flex-wrap items-center gap-3">
              {currentUser && (
                <div className="flex items-center gap-2 rounded-xl bg-black/30 px-3 py-2 text-xs text-slate-200">
                  <span>
                    Eingeloggt als <span className="font-semibold">{currentUser.displayName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-full border border-white/25 px-2 py-1 text-[11px] font-semibold text-slate-100 hover:border-emerald-300/60 hover:text-emerald-100"
                  >
                    Logout
                  </button>
                </div>
              )}
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
                  if (!currentUser) {
                    navigateWithTransition("/auth");
                  } else {
                    // Review-Bereich ist Teil der Startseite, hier koennte spaeter ein Anker/Scroll hin
                    const reviewSection = document.getElementById("review-section");
                    if (reviewSection) {
                      reviewSection.scrollIntoView({ behavior: "smooth" });
                    }
                  }
                }}
              >
                Review
              </button>
              <button
                type="button"
                onClick={() => navigateWithTransition("/auth")}
                className="rounded-xl bg-emerald-500/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500"
              >
                Login / Register
              </button>
            </div>
          </div>

          <div className="sticky top-3 z-20 -mx-4 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 backdrop-blur md:static md:-mx-0 md:border-0 md:bg-transparent md:p-0">
            <div
              className="flex gap-2 overflow-x-auto overflow-y-visible py-1 pb-2 text-sm text-slate-100 snap-x snap-mandatory"
              onTouchStart={handleTabTouchStart}
              onTouchEnd={handleTabTouchEnd}
            >
              {tabs.map((tab) => (
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
                  <span className="font-semibold whitespace-nowrap">{tab.label}</span>
                </button>
              ))}
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
                  <span className="text-lg leading-none">…</span>
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
            className={`rounded-full px-3 py-1 text-xs shadow-sm shadow-black/20 transition ${
              !activeRegion
                ? "bg-emerald-500/25 text-white border border-emerald-300/60"
                : "bg-white/5 text-slate-100 border border-white/15 hover:border-emerald-300/40"
            }`}
          >
            Alle Regionen
          </button>
          {regionOptions.map((region) => (
            <button
              key={region}
              type="button"
              onClick={() => setActiveRegion(region === activeRegion ? null : region)}
              className={`rounded-full px-3 py-1 text-xs shadow-sm shadow-black/20 transition ${
                activeRegion === region
                  ? "bg-emerald-500/25 text-white border border-emerald-300/60"
                  : "bg-white/5 text-slate-100 border border-white/15 hover:border-emerald-300/40"
              }`}
            >
              {region}
            </button>
          ))}
        </div>

        <section className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
              <span>{tabs.find((t) => t.id === activeTab)?.icon ?? ""}</span>
              <span>{tabLabel}</span>
            </h2>
            <span className="text-sm text-slate-300">Engagement + Freshness + Trust</span>
          </div>
          {loading && <div className="text-sm text-slate-300">Lade Daten...</div>}
          {error && <div className="text-sm text-rose-200">{error}</div>}
          <div
            key={`${activeTab}-${activeCategory ?? "all"}`}
            className="list-enter grid gap-5 md:grid-cols-2"
          >
            {visibleQuestions.map((q) => (
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
              <div className="inline-flex rounded-full bg-white/5 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => setDraftStatusFilter("open")}
                  className={`rounded-full px-3 py-1 transition ${
                    draftStatusFilter === "open"
                      ? "bg-sky-500/30 text-white"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  Offen
                </button>
                <button
                  type="button"
                  onClick={() => setDraftStatusFilter("accepted")}
                  className={`rounded-full px-3 py-1 transition ${
                    draftStatusFilter === "accepted"
                      ? "bg-emerald-500/30 text-white"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  Angenommen
                </button>
                <button
                  type="button"
                  onClick={() => setDraftStatusFilter("rejected")}
                  className={`rounded-full px-3 py-1 transition ${
                    draftStatusFilter === "rejected"
                      ? "bg-rose-500/30 text-white"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  Abgelehnt
                </button>
                <button
                  type="button"
                  onClick={() => setDraftStatusFilter("all")}
                  className={`rounded-full px-3 py-1 transition ${
                    draftStatusFilter === "all"
                      ? "bg-slate-700/80 text-white"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  Alle
                </button>
              </div>
            </div>
          </div>
          <div
            key={`drafts-${activeCategory ?? "all"}`}
            className="list-enter grid gap-5 md:grid-cols-2"
          >
            {visibleDrafts.map((draft) => (
              <DraftCard
                key={draft.id}
                draft={draft}
                onVote={(choice) => handleDraftVote(draft.id, choice)}
                isSubmitting={draftSubmittingId === draft.id}
                hasVoted={Boolean(reviewedDrafts[draft.id]) && !debugMultiReview}
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
    </main>
  );
}
