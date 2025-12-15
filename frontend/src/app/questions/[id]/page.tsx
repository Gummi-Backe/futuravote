import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import type { Question } from "@/app/data/mock";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import AdminControls from "./AdminControls";
import { DetailVoteButtons } from "./DetailVoteButtons";
import { TrendSparkline } from "./TrendSparkline";
import { ShareLinkButton } from "@/app/components/ShareLinkButton";
import { ReportButton } from "@/app/components/ReportButton";

export const dynamic = "force-dynamic";

async function getBaseUrl() {
  const headerStore = await headers();
  const host = headerStore.get("x-forwarded-host") ?? headerStore.get("host");
  const protocol =
    headerStore.get("x-forwarded-proto") ?? (host?.includes("localhost") ? "http" : "https");
  const envBaseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim();
  if (process.env.NODE_ENV !== "production" && envBaseUrl) {
    return envBaseUrl;
  }
  if (host) return `${protocol}://${host}`;
  return envBaseUrl ?? "http://localhost:3000";
}

async function fetchQuestion(id: string): Promise<Question | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.get("fv_session")?.value;
  const baseUrl = await getBaseUrl();

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
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-white/10 bg-white/5 p-3 shadow-md shadow-black/20 sm:p-4">
      <span className="text-xs uppercase tracking-wide text-slate-300">{label}</span>
      <span className={`break-words text-base font-semibold text-white sm:text-lg ${valueClassName ?? ""}`}>
        {value}
      </span>
      {hint ? <span className="text-xs text-slate-400">{hint}</span> : null}
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

export default async function QuestionDetail(props: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await props.params;
  const { id } = resolvedParams;

  const resolvedSearchParams = props.searchParams ? await props.searchParams : {};
  const fromParam = resolvedSearchParams?.from;
  const from = Array.isArray(fromParam) ? fromParam[0] : fromParam;
  const cameFromAdminReports = from === "admin_reports";

  const question = await fetchQuestion(id);
  if (!question) {
    notFound();
  }

  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const currentUser = sessionId ? await getUserBySessionSupabase(sessionId) : null;
  const isAdmin = currentUser?.role === "admin";

  const backHref = isAdmin && cameFromAdminReports ? "/admin/reports" : "/";
  const backLabel = isAdmin && cameFromAdminReports ? "← Zurück zu Meldungen" : "← Zurück zum Feed";

  const yesVotes = question.yesVotes ?? 0;
  const noVotes = question.noVotes ?? 0;
  const totalVotes = yesVotes + noVotes;
  const views = question.views ?? 0;
  const rankingScore =
    typeof question.rankingScore === "number" ? question.rankingScore.toFixed(2) : "-";
  const createdLabel = question.createdAt
    ? new Date(question.createdAt).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "unbekannt";
  const statusLabel =
    question.status === "archived" ? "gestoppt" : question.status ?? "aktiv";

  const votedLabel =
    question.userChoice === "yes"
      ? "Du hast Ja gestimmt"
      : question.userChoice === "no"
        ? "Du hast Nein gestimmt"
        : null;

  const baseUrl = await getBaseUrl();
  const shareUrl =
    question.visibility === "link_only" && question.shareId
      ? `${baseUrl}/p/${encodeURIComponent(question.shareId)}`
      : `${baseUrl}/questions/${encodeURIComponent(id)}`;

  return (
    <main className="page-enter min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto max-w-4xl px-4 pb-12 pt-8 sm:pt-10 lg:px-6">
        <Link href={backHref} className="text-sm text-emerald-100 hover:text-emerald-200">
          {backLabel}
        </Link>

        <header className="mt-4 flex flex-col gap-4 rounded-3xl border border-white/10 bg-white/10 px-4 py-5 sm:px-6 sm:py-6 shadow-2xl shadow-emerald-500/10 backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-center gap-3 text-sm font-semibold text-slate-100">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg sm:h-11 sm:w-11"
                style={{
                  backgroundColor: `${question.categoryColor}22`,
                  color: question.categoryColor,
                }}
              >
                {question.categoryIcon}
              </span>
              <div className="flex flex-col leading-tight">
                <span className="text-xs uppercase tracking-[0.2rem] text-slate-300">
                  {question.category}
                </span>
                <span className="text-sm text-slate-200">{question.summary}</span>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2 text-left sm:items-end sm:text-right">
              <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                ⏳ {formatDeadline(question.closesAt)}
              </span>
              {votedLabel && (
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold text-emerald-100">
                  {votedLabel}
                </span>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
            {question.imageUrl && (
              <div className="inline-flex max-h-20 max-w-[5.5rem] flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black/30 sm:max-h-24 sm:max-w-[7rem]">
                <img
                  src={question.imageUrl}
                  alt={question.title}
                  className="h-auto w-auto max-h-20 max-w-[5.5rem] object-contain sm:max-h-24 sm:max-w-[7rem]"
                  loading="lazy"
                />
              </div>
            )}
            <div className="flex-1">
              <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl md:text-4xl">
                {question.title}
              </h1>
              {question.imageCredit && (
                <p className="mt-1 text-xs text-slate-400">{question.imageCredit}</p>
              )}
            </div>
          </div>

          {question.description && (
            <p className="mt-4 text-sm text-slate-200 sm:text-base">{question.description}</p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-white/5 px-3 py-1">
                {question.yesPct}% Ja ({yesVotes})
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1">
                {question.noPct}% Nein ({noVotes})
              </span>
              <span className="rounded-full bg-white/5 px-3 py-1">
                Insgesamt {totalVotes} Stimmen
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {question.visibility === "link_only" ? (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-100">
                  Privat (nur per Link)
                </span>
              ) : null}
              <ShareLinkButton url={shareUrl} label="Teilen" action="share" />
              <ReportButton kind="question" itemId={id} itemTitle={question.title} shareId={question.shareId ?? null} />
            </div>
          </div>

          {isAdmin && (
            <div className="mt-4">
              <AdminControls questionId={id} isArchived={question.status === "archived"} />
            </div>
          )}
        </header>

        <section className="mt-6 grid gap-6 sm:mt-8 md:grid-cols-3">
          <div className="md:col-span-2 flex min-h-0 flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-emerald-500/15 sm:p-6">
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span>Community glaubt</span>
              <span className="font-semibold text-white">
                {question.yesPct}% Ja · {question.noPct}% Nein
              </span>
            </div>
            <VoteBar yesPct={question.yesPct} noPct={question.noPct} />
            <div className="min-h-0 flex-1">
              <TrendSparkline questionId={id} />
            </div>
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-emerald-500/15 sm:p-6">
            <h3 className="text-sm font-semibold text-white">Meta &amp; Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatsCard
                label="Votes (absolut)"
                value={totalVotes.toString()}
                hint={`Ja ${yesVotes} / Nein ${noVotes}`}
              />
              <StatsCard
                label="Views"
                value={views.toString()}
                hint="Wie oft die Frage im Feed angezeigt wurde"
              />
              <StatsCard
                label="Ranking-Score"
                value={rankingScore}
                hint="Kombiniert Engagement, Qualität und Frische"
              />
              <StatsCard
                label="Status"
                value={statusLabel}
                hint={formatDeadline(question.closesAt)}
                valueClassName="text-base"
              />
            </div>
            <div className="space-y-2 text-sm text-slate-200">
              <div className="flex justify-between">
                <span>Erstellt am</span>
                <span>{createdLabel}</span>
              </div>
              <div className="flex justify-between">
                <span>Endet</span>
                <span>{formatDeadline(question.closesAt)}</span>
              </div>
              <div className="flex justify-between">
                <span>Kategorie</span>
                <span>{question.category}</span>
              </div>
            </div>
          </div>
        </section>

        <DetailVoteButtons
          questionId={id}
          initialChoice={
            question.userChoice === "yes" || question.userChoice === "no"
              ? question.userChoice
              : null
          }
        />
      </div>
    </main>
  );
}
