import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import {
  getDraftsForCreatorFromSupabase,
  getQuestionsVotedByUserFromSupabase,
  type QuestionWithUserVote,
} from "@/app/data/dbSupabase";
import type { Draft } from "@/app/data/mock";

export const dynamic = "force-dynamic";

type SearchParams = {
  typ?: string;
  category?: string;
};

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

function resolveViewConfig(typ?: string): ViewConfig {
  switch (typ) {
    case "drafts_accepted":
      return {
        mode: "drafts",
        typ: "drafts_accepted",
        title: "Vorgeschlagene Fragen – angenommen",
        description: "Alle deine Vorschlaege, die es in die Hauptabstimmung geschafft haben.",
        status: "accepted",
      };
    case "drafts_rejected":
      return {
        mode: "drafts",
        typ: "drafts_rejected",
        title: "Vorgeschlagene Fragen – abgelehnt",
        description: "Vorschlaege, die von der Community abgelehnt wurden.",
        status: "rejected",
      };
    case "votes_yes":
      return {
        mode: "votes",
        typ: "votes_yes",
        title: "Meine Abstimmungen – Ja",
        description: "Fragen, bei denen du mit Ja abgestimmt hast.",
        choice: "yes",
      };
    case "votes_no":
      return {
        mode: "votes",
        typ: "votes_no",
        title: "Meine Abstimmungen – Nein",
        description: "Fragen, bei denen du mit Nein abgestimmt hast.",
        choice: "no",
      };
    case "votes_all":
      return {
        mode: "votes",
        typ: "votes_all",
        title: "Meine Abstimmungen – alle",
        description: "Alle Fragen, bei denen du bereits abgestimmt hast.",
        choice: "all",
      };
    case "drafts_all":
    default:
      return {
        mode: "drafts",
        typ: "drafts_all",
        title: "Vorgeschlagene Fragen – alle",
        description: "Alle Fragen, die du bisher als Draft vorgeschlagen hast.",
        status: "all",
      };
  }
}

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
      {draft.description && <p className="text-xs text-slate-200">{draft.description}</p>}
      <div className="flex items-center gap-2 text-xs text-slate-200">
        <span className="font-semibold text-emerald-200">{yesPct}% gute Frage</span>
        <span className="text-slate-400">·</span>
        <span className="font-semibold text-rose-200">{noPct}% ablehnen</span>
      </div>
      <VoteBar yesPct={yesPct} noPct={noPct} />
    </article>
  );
}

function QuestionActivityCard({ question }: { question: QuestionWithUserVote }) {
  const votedLabel =
    question.userChoice === "yes"
      ? "Du hast abgestimmt: Ja"
      : question.userChoice === "no"
      ? "Du hast abgestimmt: Nein"
      : null;

  const isClosingSoon = question.status === "closingSoon";

  const badge =
    question.status === "closingSoon"
      ? { label: "Endet bald", className: "bg-amber-500/15 text-amber-200" }
      : question.status === "new"
      ? { label: "Neu", className: "bg-emerald-500/15 text-emerald-200" }
      : question.status === "trending"
      ? { label: "Trending", className: "bg-rose-500/15 text-rose-100" }
      : question.status === "top"
      ? { label: "Top", className: "bg-indigo-500/15 text-indigo-100" }
      : question.status === "archived"
      ? { label: "Gestoppt", className: "bg-slate-500/20 text-slate-100" }
      : null;

  return (
    <article
      className={`group relative flex h-full w-full max-w-xl flex-col gap-5 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-emerald-500/15 transition hover:-translate-y-1 hover:border-emerald-300/40 hover:shadow-emerald-400/25 mx-auto ${
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
            <span className="text-[11px] text-slate-400">
              {question.region && question.region !== "Global" ? question.region : "Global"}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
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
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="card-title-wrap text-lg font-semibold leading-snug text-white">{question.title}</h3>
        {question.description && (
          <p className="text-sm text-slate-200 line-clamp-3">{question.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-slate-300">
        <span className="rounded-full bg-white/5 px-3 py-1">
          {formatDeadline(question.closesAt ?? question.createdAt)}
        </span>
        <span className="text-[11px] text-slate-400">
          Ja {question.yesPct}% · Nein {question.noPct}%
        </span>
      </div>

      <VoteBar yesPct={question.yesPct} noPct={question.noPct} />

      <div className="flex justify-end">
        <Link
          href={`/questions/${question.id}`}
          className="text-xs font-semibold text-emerald-200 hover:text-emerald-100"
        >
          Details ansehen &rarr;
        </Link>
      </div>
    </article>
  );
}

export default async function ProfilAktivitaetPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const resolvedSearch = await searchParams;
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) {
    redirect("/auth");
  }

  const user = await getUserBySessionSupabase(sessionId);
  if (!user) {
    redirect("/auth");
  }

  const config = resolveViewConfig(resolvedSearch?.typ);
  const categoryFilter = resolvedSearch?.category;

  let drafts: Draft[] = [];
  let questions: QuestionWithUserVote[] = [];

  if (config.mode === "drafts") {
    drafts = await getDraftsForCreatorFromSupabase({ creatorId: user.id, status: config.status });
  } else {
    questions = await getQuestionsVotedByUserFromSupabase({
      userId: user.id,
      choice: config.choice === "all" ? "all" : config.choice,
      limit: 100,
    });

    if (categoryFilter) {
      const norm = categoryFilter.toLowerCase();
      questions = questions.filter((q) => q.category.toLowerCase() === norm);
    }
  }

  const itemCount = config.mode === "drafts" ? drafts.length : questions.length;

  return (
    <main className="page-enter min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 pb-16 pt-10">
        <Link href="/profil" className="self-start text-sm text-emerald-100 hover:text-emerald-200">
          &larr; Zurueck zum Profil
        </Link>

        <header className="mt-2 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">Profil-Aktivität</p>
          <h1 className="mt-1 text-2xl font-bold text-white">{config.title}</h1>
          <p className="mt-2 text-sm text-slate-200">{config.description}</p>
          <p className="mt-3 text-xs text-slate-400">
            Aktuell{" "}
            <span className="font-semibold text-emerald-200">
              {itemCount} {itemCount === 1 ? "Eintrag" : "Eintraege"}
            </span>{" "}
            aus deiner bisherigen Nutzung.
          </p>
        </header>

        {itemCount === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-white/10 bg-white/5 px-4 py-6 text-sm text-slate-300 text-center">
            Hier ist noch nichts zu sehen. Sobald du Vorschlaege einreichst oder abstimmst, erscheinen
            die passenden Kacheln an dieser Stelle.
          </p>
        ) : (
          <section className="mt-4 list-enter grid gap-5 md:grid-cols-2">
            {config.mode === "drafts"
              ? drafts.map((draft) => <DraftActivityCard key={draft.id} draft={draft} />)
              : questions.map((q) => <QuestionActivityCard key={q.id} question={q} />)}
          </section>
        )}
      </div>
    </main>
  );
}
