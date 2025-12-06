"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  allQuestions as initialQuestions,
  categories,
  draftQueue as initialDrafts,
  type Draft,
  type Question,
} from "./data/mock";

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

function EventCard({ question }: { question: Question }) {
  const badge = statusBadge(question.status);

  return (
    <article className="group relative flex h-full flex-col gap-5 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-2xl shadow-emerald-500/10 transition hover:-translate-y-1 hover:border-emerald-300/40 hover:shadow-emerald-400/25">
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
          {question.status === "trending" && (
            <span className="flex items-center gap-1 text-xs text-rose-200">
              <span className="h-2 w-2 animate-pulse rounded-full bg-rose-300" />
              Hot
            </span>
          )}
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-xl font-bold leading-tight text-white">{question.title}</h3>
        <div className="flex items-center justify-between rounded-2xl bg-black/25 px-4 py-3 text-xs text-slate-200">
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-100">
            <span className="text-base">⏳</span>
            <span>{formatDeadline(question.closesAt)}</span>
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
          className={`card-button yes ${
            question.userChoice === "yes" ? "ring-2 ring-emerald-200" : "hover:shadow-emerald-400/40"
          }`}
        >
          Ja
        </button>
        <button
          type="button"
          className={`card-button no ${
            question.userChoice === "no" ? "ring-2 ring-rose-200" : "hover:shadow-rose-400/40"
          }`}
        >
          Nein
        </button>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-300">
        <Link href={`/questions/${question.id}`} className="text-emerald-100 hover:text-emerald-200">
          Details ansehen →
        </Link>
        <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-slate-200">ID: {question.id}</span>
      </div>
    </article>
  );
}

function DraftCard({ draft }: { draft: Draft }) {
  const total = Math.max(1, draft.votesFor + draft.votesAgainst);
  const yesPct = Math.round((draft.votesFor / total) * 100);
  const noPct = 100 - yesPct;

  return (
    <article className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-sky-500/15 transition hover:-translate-y-1 hover:border-sky-200/30">
      <div className="flex items-center justify-between text-xs text-slate-200">
        <span className="rounded-full bg-sky-500/15 px-3 py-1 font-semibold text-sky-100">Draft Review</span>
        <span className="rounded-full bg-white/10 px-3 py-1 text-slate-200">{draft.timeLeftHours}h</span>
      </div>
      <h4 className="text-lg font-semibold text-white leading-snug">{draft.title}</h4>
      <p className="text-xs font-medium uppercase tracking-wide text-slate-300">{draft.category}</p>
      <div className="flex items-center gap-2 text-xs text-slate-200">
        <span className="font-semibold text-emerald-200">{yesPct}% gute Frage</span>
        <span className="text-slate-400">·</span>
        <span className="font-semibold text-rose-200">{noPct}% ablehnen</span>
      </div>
      <VoteBar yesPct={yesPct} noPct={noPct} />
      <div className="flex gap-3">
        <button type="button" className="card-button yes w-full">
          Gute Frage
        </button>
        <button type="button" className="card-button no w-full">
          Ablehnen
        </button>
      </div>
    </article>
  );
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("all");
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [drafts, setDrafts] = useState<Draft[]>(initialDrafts);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    fetch("/api/questions")
      .then(async (res) => {
        if (!res.ok) throw new Error("API Response not ok");
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        setQuestions(data.questions ?? initialQuestions);
        setDrafts(data.drafts ?? initialDrafts);
        setError(null);
      })
      .catch(() => {
        if (!isMounted) return;
        setQuestions(initialQuestions);
        setDrafts(initialDrafts);
        setError("Konnte Daten nicht laden (zeige Mock-Daten).");
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredQuestions = useMemo(() => {
    if (activeTab === "all") return questions;
    if (activeTab === "trending") return questions.filter((q) => q.status === "trending");
    if (activeTab === "new") return questions.filter((q) => q.status === "new");
    if (activeTab === "unanswered") return questions.filter((q) => !q.userChoice);
    return questions.filter((q) => q.status === "top" || q.status === "closingSoon");
  }, [activeTab, questions]);

  const tabLabel = feedTabs.find((t) => t.id === activeTab)?.label ?? "Feed";

  return (
    <main className="min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 lg:px-6">
        <header className="flex flex-col gap-6 rounded-3xl border border-white/10 bg-white/10 px-6 py-6 shadow-2xl shadow-emerald-500/10 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/20 text-xl text-emerald-100 shadow-lg shadow-emerald-500/40">
                FV
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.3rem] text-emerald-200/80">futuravote</p>
                <h1 className="text-3xl font-semibold leading-tight text-white md:text-4xl">Prognosen, schnell abgestimmt.</h1>
                <p className="mt-1 max-w-3xl text-sm text-slate-200">
                  Ja/Nein-Kacheln, Community-Review fuer neue Fragen, Ranking nach Engagement und Freshness.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button className="rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-lg shadow-white/30 transition hover:-translate-y-0.5 hover:shadow-white/50">
                Frage stellen
              </button>
              <button className="rounded-xl border border-white/25 px-4 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:border-emerald-300/60">
                Review
              </button>
              <button className="rounded-xl bg-emerald-500/80 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:-translate-y-0.5 hover:bg-emerald-500">
                Login / Register
              </button>
            </div>
          </div>

          <div className="sticky top-3 z-20 -mx-4 rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-3 backdrop-blur md:static md:-mx-0 md:border-0 md:bg-transparent md:p-0">
            <div className="flex gap-2 overflow-x-auto pb-2 text-sm text-slate-100 snap-x snap-mandatory">
              {feedTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex min-w-[132px] items-center gap-2 rounded-full px-4 py-2 shadow-sm shadow-black/20 backdrop-blur transition snap-center ${
                    activeTab === tab.id
                      ? "bg-white/20 border border-white/30 text-white"
                      : "bg-white/10 border border-white/15 text-slate-200"
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span className="font-semibold whitespace-nowrap">{tab.label}</span>
                </button>
              ))}
            </div>

            <div className="mt-1 flex gap-2 overflow-x-auto pb-1 text-sm text-slate-100 snap-x snap-mandatory">
              {categories.map((cat) => (
                <span
                  key={cat.label}
                  className="inline-flex min-w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 shadow-sm shadow-black/20 snap-center"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: cat.color }}
                    aria-hidden
                  />
                  <span>{cat.icon}</span>
                  <span>{cat.label}</span>
                </span>
              ))}
            </div>
          </div>
        </header>

        <section className="mt-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
              <span>{feedTabs.find((t) => t.id === activeTab)?.icon ?? ""}</span>
              <span>{tabLabel}</span>
            </h2>
            <span className="text-sm text-slate-300">Engagement + Freshness + Trust</span>
          </div>
          {loading && <div className="text-sm text-slate-300">Lade Daten...</div>}
          {error && <div className="text-sm text-rose-200">{error}</div>}
          <div className="grid gap-5 md:grid-cols-2">
            {filteredQuestions.map((q) => (
              <EventCard key={q.id} question={q} />
            ))}
          </div>
        </section>

        <section className="mt-10 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-white">
              <span>🗳️</span> <span>Review-Bereich (Drafts)</span>
            </h2>
            <span className="text-sm text-slate-300">Community entscheidet, was live geht</span>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {drafts.map((draft) => (
              <DraftCard key={draft.id} draft={draft} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
