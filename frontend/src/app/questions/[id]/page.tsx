import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import type { Question } from "@/app/data/mock";

export const dynamic = "force-dynamic";

function getBaseUrl() {
  const headerStore = headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol = headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  if (host) return `${protocol}://${host}`;
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

async function fetchQuestion(id: string): Promise<Question | null> {
  const cookieStore = cookies();
  const cookieHeader = cookieStore.get("fv_session")?.value;
  const baseUrl = getBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/api/questions/${id}`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: `fv_session=${cookieHeader}` } : undefined,
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.question as Question) ?? null;
  } catch {
    return null;
  }
}

function StatsCard({
  label,
  value,
  hint,
  valueClassName,
}: { label: string; value: string; hint?: string; valueClassName?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-md shadow-black/20">
      <span className="text-xs uppercase tracking-wide text-slate-300">{label}</span>
      <span className={`break-words text-lg font-semibold text-white ${valueClassName ?? ""}`}>{value}</span>
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
    </div>
  );
}

function SparklinePlaceholder() {
  return (
    <div className="h-14 w-full rounded-xl border border-white/10 bg-black/20 p-2">
      <svg viewBox="0 0 100 30" className="h-full w-full text-emerald-300" aria-hidden>
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points="0,20 15,22 30,18 45,12 60,15 75,9 90,14 100,10"
        />
      </svg>
      <div className="mt-1 text-[11px] text-slate-400">Trend (Placeholder)</div>
    </div>
  );
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

export default async function QuestionDetail({ params }: { params: { id: string } }) {
  const { id } = params;
  const question = await fetchQuestion(id);
  if (!question) {
    notFound();
  }
  const votedLabel =
    question.userChoice === "yes" ? "Du hast Ja gestimmt" : question.userChoice === "no" ? "Du hast Nein gestimmt" : null;

  return (
    <main className="min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto max-w-4xl px-4 pb-12 pt-10 lg:px-6">
        <Link href="/" className="text-sm text-emerald-100 hover:text-emerald-200">
          &larr; Zurueck zum Feed
        </Link>

        <header className="mt-4 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/10 px-6 py-6 shadow-2xl shadow-emerald-500/10 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-100">
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full text-lg"
                style={{ backgroundColor: `${question.categoryColor}22`, color: question.categoryColor }}
              >
                {question.categoryIcon}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-xs uppercase tracking-[0.2rem] text-slate-300">{question.category}</span>
                <span className="text-sm text-slate-200">{question.summary}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 text-right">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                ? {formatDeadline(question.closesAt)}
              </span>
              {votedLabel && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                  {votedLabel}
                </span>
              )}
            </div>
          </div>
          <h1 className="text-3xl font-bold leading-tight text-white md:text-4xl">{question.title}</h1>
          <p className="text-base text-slate-200">{question.description}</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-200">
            <span className="rounded-full bg-white/5 px-3 py-1">{question.yesPct}% Ja</span>
            <span className="rounded-full bg-white/5 px-3 py-1">{question.noPct}% Nein</span>
            <span className="rounded-full bg-white/5 px-3 py-1">ID: {question.id}</span>
          </div>
        </header>

        <section className="mt-8 grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-emerald-500/15">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span>Community glaubt</span>
              <span className="font-semibold text-white">
                {question.yesPct}% Ja ú {question.noPct}% Nein
              </span>
            </div>
            <VoteBar yesPct={question.yesPct} noPct={question.noPct} />
            <SparklinePlaceholder />
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-xl shadow-emerald-500/15">
            <h3 className="text-sm font-semibold text-white">Meta & Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatsCard label="Votes (rel.)" value={`${question.yesPct + question.noPct}%`} hint="Absolutwerte folgen" />
              <StatsCard label="Views" value="-" hint="Platzhalter bis API" />
              <StatsCard label="Ranking-Score" value="-" hint="Platzhalter bis API" />
              <StatsCard
                label="Status"
                value={question.status ?? "aktiv"}
                hint={formatDeadline(question.closesAt)}
                valueClassName="text-base"
              />
            </div>
            <div className="space-y-2 text-sm text-slate-200">
              <div className="flex justify-between"><span>Endet</span><span>{formatDeadline(question.closesAt)}</span></div>
              <div className="flex justify-between"><span>Kategorie</span><span>{question.category}</span></div>
            </div>
            <div className="pt-2 text-xs text-slate-400">
              Weitere Stats (Views, Votes absolut, Ranking-Score) folgen mit echter API.
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2">
          <button className="card-button yes">Ja</button>
          <button className="card-button no">Nein</button>
        </section>
      </div>
    </main>
  );
}
