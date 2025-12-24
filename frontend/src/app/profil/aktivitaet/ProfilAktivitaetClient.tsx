"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SmartBackButton } from "@/app/components/SmartBackButton";
import type { Draft, Question } from "@/app/data/mock";
import { PROFILE_ACTIVITY_CACHE_PREFIX } from "@/app/lib/profileCache";

type ViewConfig =
  | {
      mode: "drafts";
      typ: string;
      title: string;
      description: string;
      status: "all" | "open" | "accepted" | "rejected";
    }
  | {
      mode: "votes";
      typ: string;
      title: string;
      description: string;
      choice: "all" | "yes" | "no";
    };

type QuestionWithUserVote = Question & { votedAt: string };

type ActivityResponse =
  | {
      ok: true;
      config: ViewConfig;
      drafts: Draft[];
      questions: QuestionWithUserVote[];
      itemCount: number;
    }
  | { error: string };

const CACHE_TTL_MS = 30_000;

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

function VoteBar({ yesPct, noPct }: { yesPct: number; noPct: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-emerald-400 transition-all duration-500 ease-out" style={{ width: `${yesPct}%` }} />
      <div
        className="absolute right-0 top-0 h-full bg-rose-400 transition-all duration-500 ease-out"
        style={{ width: `${noPct}%` }}
      />
    </div>
  );
}

function DraftActivityCard({ draft }: { draft: Draft }) {
  const total = Math.max(1, draft.votesFor + draft.votesAgainst);
  const yesPct = Math.round((draft.votesFor / total) * 100);
  const noPct = 100 - yesPct;
  const isClosed = draft.status === "accepted" || draft.status === "rejected";
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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/5 text-xl">
            {draft.category?.slice(0, 1)?.toUpperCase() || "?"}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{draft.title}</p>
            <p className="mt-1 text-xs text-slate-400">
              {draft.region && draft.region !== "Global" ? draft.region : "Global"} · {draft.category}
            </p>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}>{statusLabel}</span>
          <span className="rounded-full bg-white/5 px-3 py-1 text-[11px] text-slate-200">
            {isClosed ? "Beendet" : `Noch ${formatDraftTimeLeft(draft.timeLeftHours)} `}
          </span>
        </div>
      </div>

      {draft.description ? <p className="text-sm text-slate-200 line-clamp-3">{draft.description}</p> : null}

      <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
        <span className="text-[11px] text-slate-400">
          Gut {draft.votesFor} ({yesPct}%) · Schlecht {draft.votesAgainst} ({noPct}%)
        </span>
      </div>

      <VoteBar yesPct={yesPct} noPct={noPct} />

      <div className="flex justify-end">
        <Link href={`/drafts/${draft.id}`} className="text-xs font-semibold text-emerald-200 hover:text-emerald-100">
          Details ansehen &rarr;
        </Link>
      </div>
    </article>
  );
}

function QuestionActivityCard({ question }: { question: QuestionWithUserVote }) {
  const answerMode = question.answerMode ?? "binary";
  const isOptions = answerMode === "options";
  const voted = isOptions ? Boolean((question as any).userOptionId) : Boolean(question.userChoice);
  const votedTooltip = voted
    ? isOptions
      ? (() => {
          const optionId = String((question as any).userOptionId ?? "");
          const label = optionId ? (question as any).options?.find((o: any) => o.id === optionId)?.label : null;
          return label ? `Du hast abgestimmt: ${label}` : "Du hast abgestimmt";
        })()
      : question.userChoice === "yes"
        ? "Du hast abgestimmt: Ja"
        : question.userChoice === "no"
          ? "Du hast abgestimmt: Nein"
          : "Du hast abgestimmt"
    : null;

  const badge =
    question.resolvedOutcome === "yes" || question.resolvedOutcome === "no"
      ? {
          label: question.userChoice ? (question.userChoice === question.resolvedOutcome ? "Richtig" : "Falsch") : "Ergebnis da",
          className:
            question.userChoice && question.userChoice === question.resolvedOutcome
              ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/40"
              : "bg-amber-500/15 text-amber-100 border border-amber-400/40",
        }
      : null;

  return (
    <article className="flex w-full max-w-xl flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-emerald-500/15 transition hover:-translate-y-1 hover:border-emerald-200/30 mx-auto">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-white/5 text-xl">
            {question.categoryIcon}
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-xs uppercase tracking-[0.2rem] text-slate-300">{question.category}</span>
            <span className="text-[11px] text-slate-400">{question.region && question.region !== "Global" ? question.region : "Global"}</span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {badge && <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badge.className}`}>{badge.label}</span>}
          {votedTooltip ? (
            <span
              title={votedTooltip}
              aria-label={votedTooltip}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-300/35 bg-emerald-500/15 text-[12px] font-bold text-emerald-50"
            >
              ✓
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="card-title-wrap text-lg font-semibold leading-snug text-white">{question.title}</h3>
        {question.description ? <p className="text-sm text-slate-200 line-clamp-3">{question.description}</p> : null}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
        <span className="rounded-full bg-white/5 px-3 py-1">{formatDeadline(question.closesAt ?? question.createdAt ?? "")}</span>
        <span className="text-[11px] text-slate-400">
          Ja {question.yesPct}% · Nein {question.noPct}%
        </span>
      </div>

      <VoteBar yesPct={question.yesPct} noPct={question.noPct} />

      <div className="flex justify-end">
        <Link href={`/questions/${question.id}`} className="text-xs font-semibold text-emerald-200 hover:text-emerald-100">
          Details ansehen &rarr;
        </Link>
      </div>
    </article>
  );
}

function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-3xl border border-white/10 bg-white/5 p-5 shadow-xl shadow-black/20">
      <div className="h-4 w-2/3 rounded bg-white/10" />
      <div className="mt-3 h-3 w-11/12 rounded bg-white/10" />
      <div className="mt-2 h-3 w-10/12 rounded bg-white/10" />
      <div className="mt-4 h-2 w-full rounded bg-white/10" />
      <div className="mt-4 h-8 w-28 rounded-full bg-white/10" />
    </div>
  );
}

export function ProfilAktivitaetClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const typ = searchParams.get("typ") ?? "drafts_all";
  const category = searchParams.get("category") ?? "";

  const cacheKey = useMemo(() => `${PROFILE_ACTIVITY_CACHE_PREFIX}${typ}:${category}`, [category, typ]);

  const [config, setConfig] = useState<ViewConfig | null>(null);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [questions, setQuestions] = useState<QuestionWithUserVote[] | null>(null);
  const [itemCount, setItemCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);

  const readCache = useCallback(() => {
    try {
      const raw = window.sessionStorage.getItem(cacheKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { cachedAt: number; data: ActivityResponse };
      if (!parsed?.cachedAt || !parsed?.data) return null;
      if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
      return parsed;
    } catch {
      return null;
    }
  }, [cacheKey]);

  const writeCache = useCallback(
    (data: ActivityResponse) => {
      try {
        window.sessionStorage.setItem(cacheKey, JSON.stringify({ cachedAt: Date.now(), data }));
      } catch {
        // ignore
      }
    },
    [cacheKey]
  );

  const applyResponse = useCallback((payload: ActivityResponse) => {
    if ("error" in payload) {
      setError(payload.error);
      setConfig(null);
      setDrafts([]);
      setQuestions([]);
      setItemCount(0);
      return;
    }

    setError(null);
    setConfig(payload.config);
    setDrafts(payload.drafts ?? []);
    setQuestions(payload.questions ?? []);
    setItemCount(payload.itemCount ?? 0);
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = new URL("/api/profil/activity", window.location.origin);
      url.searchParams.set("typ", typ);
      if (category) url.searchParams.set("category", category);
      const res = await fetch(url.toString(), { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ActivityResponse | null;
      if (res.status === 401) {
        router.push("/auth");
        return;
      }
      if (!res.ok) {
        throw new Error((json as any)?.error ?? "Profil-Aktivität konnte nicht geladen werden.");
      }
      const payload = (json as ActivityResponse) ?? { error: "Profil-Aktivität konnte nicht geladen werden." };
      applyResponse(payload);
      writeCache(payload);
      setUpdatedAt(Date.now());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Profil-Aktivität konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }, [applyResponse, category, router, typ, writeCache]);

  useEffect(() => {
    const cached = readCache();
    if (cached?.data) {
      applyResponse(cached.data);
      setUpdatedAt(cached.cachedAt);
    } else {
      setConfig(null);
      setDrafts(null);
      setQuestions(null);
      setItemCount(null);
    }
    void fetchData();
  }, [applyResponse, fetchData, readCache]);

  const title = config?.title ?? "Profil-Aktivität";
  const description = config?.description ?? "Deine bisherigen Einträge im Überblick.";
  const mode = config?.mode ?? null;

  return (
    <main className="page-enter min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-16 pt-10">
        <SmartBackButton
          fallbackHref="/profil"
          label="← Zurück zum Profil"
          className="self-start text-sm text-emerald-100 hover:text-emerald-200 bg-transparent p-0"
        />

        <header className="mt-2 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">Profil-Aktivität</p>
          <h1 className="mt-1 text-2xl font-bold text-white">{title}</h1>
          <p className="mt-2 text-sm text-slate-200">{description}</p>
          <p className="mt-3 text-xs text-slate-400">
            Aktuell{" "}
            <span className="font-semibold text-emerald-200">
              {itemCount ?? "…"} {itemCount === 1 ? "Eintrag" : "Einträge"}
            </span>{" "}
            aus deiner bisherigen Nutzung.
            {updatedAt ? <span className="text-slate-500"> · Cache: {Math.round((Date.now() - updatedAt) / 1000)}s</span> : null}
          </p>
        </header>

        {error ? (
          <p className="mt-2 rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {error}
          </p>
        ) : null}

        {mode === null && drafts === null && questions === null ? (
          <section className="mt-4 grid gap-5 md:grid-cols-2">
            {Array.from({ length: 4 }).map((_, idx) => (
              <SkeletonCard key={idx} />
            ))}
          </section>
        ) : itemCount === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300 text-center">
            Hier ist noch nichts zu sehen. Sobald du Vorschläge einreichst oder abstimmst, erscheinen die passenden Kacheln an dieser Stelle.
          </p>
        ) : (
          <section className="mt-4 list-enter grid gap-5 md:grid-cols-2">
            {mode === "drafts"
              ? (drafts ?? []).map((draft) => <DraftActivityCard key={draft.id} draft={draft} />)
              : (questions ?? []).map((q) => <QuestionActivityCard key={q.id} question={q} />)}
          </section>
        )}

        {loading && (drafts?.length || questions?.length) ? (
          <p className="mt-2 text-center text-xs text-slate-400">Aktualisiere…</p>
        ) : null}
      </div>
    </main>
  );
}
