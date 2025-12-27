import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import type { QuestionWithVotes } from "@/app/data/dbSupabase";
import { getQuestionByIdFromSupabase } from "@/app/data/dbSupabase";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import AdminControls from "./AdminControls";
import { DetailVoteButtons } from "./DetailVoteButtons";
import { TrendSparkline } from "./TrendSparkline";
import { ShareLinkButton } from "@/app/components/ShareLinkButton";
import { ReportButton } from "@/app/components/ReportButton";
import { EmbedWidgetButton } from "@/app/components/EmbedWidgetButton";
import { ResolvedSuccessCard } from "@/app/components/ResolvedSuccessCard";
import { CommentsSection } from "./CommentsSection";
import { QuestionViewTracker } from "@/app/components/QuestionViewTracker";
import { SmartBackButton } from "@/app/components/SmartBackButton";
import { CommunityResolutionProposals } from "./CommunityResolutionProposals";

export const dynamic = "force-dynamic";

function getMetadataBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de";
}

function clampText(value: string, maxLen: number) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }> | { id: string };
}): Promise<Metadata> {
  const resolvedParams = await (props as any).params;
  const id = (resolvedParams?.id as string) ?? "";

  const metadataBase = new URL(getMetadataBaseUrl());
  const canonical = `/questions/${encodeURIComponent(id)}`;

  const question = await getQuestionByIdFromSupabase(id).catch(() => null);
  if (!question || question.visibility === "link_only") {
    return {
      metadataBase,
      title: "Frage nicht gefunden - Future-Vote",
      robots: { index: false, follow: false },
    };
  }

  const title = `${question.title} - Future-Vote`;
  const baseDesc =
    question.description?.trim() ||
    `Prognosefrage in ${question.category}${question.region ? ` · ${question.region}` : ""}.`;
  const description = clampText(baseDesc, 180);

  const imageUrl = question.imageUrl?.trim() || "/opengraph-image";

  return {
    metadataBase,
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: question.title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

async function fetchQuestion(id: string, sessionId?: string | null): Promise<QuestionWithVotes | null> {
  try {
    return await getQuestionByIdFromSupabase(id, sessionId ?? undefined);
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

function formatDateTimeLocal(value?: string | null) {
  if (!value) return null;
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  return new Date(ms).toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  const cameFromAdminResolutions = from === "admin_resolutions";

  const cookieStore = await cookies();
  const fvSessionId = cookieStore.get("fv_session")?.value ?? null;
  const sessionId = cookieStore.get("fv_user")?.value;
  const currentUser = sessionId ? await getUserBySessionSupabase(sessionId) : null;
  const isAdmin = currentUser?.role === "admin";

  const question = await fetchQuestion(id, fvSessionId);
  if (!question) {
    notFound();
  }
  if (question.visibility === "link_only") {
    notFound();
  }

  const backHref =
    isAdmin && cameFromAdminReports
      ? "/admin/reports"
      : isAdmin && cameFromAdminResolutions
        ? "/admin/resolutions"
        : "/";
  const backLabel =
    isAdmin && cameFromAdminReports
      ? "← Zurück zu Meldungen"
      : isAdmin && cameFromAdminResolutions
        ? "← Zurück zu Auflösungen"
        : "← Zurück";

  const answerMode = question.answerMode ?? "binary";
  const isResolvable = question.isResolvable ?? true;
  const options = question.options ?? [];
  const optionsTotalVotes =
    answerMode === "options"
      ? options.reduce((sum, opt) => sum + Math.max(0, opt.votesCount ?? 0), 0)
      : 0;

  const yesVotes = answerMode === "binary" ? (question.yesVotes ?? 0) : 0;
  const noVotes = answerMode === "binary" ? (question.noVotes ?? 0) : 0;
  const totalVotes = answerMode === "options" ? optionsTotalVotes : yesVotes + noVotes;
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
  const ended = String(question.closesAt).slice(0, 10) < new Date().toISOString().slice(0, 10);

  const resolutionDeadlineLabel = formatDateTimeLocal(question.resolutionDeadline) ?? question.resolutionDeadline ?? null;
  const resolvedAtLabel = formatDateTimeLocal(question.resolvedAt) ?? question.resolvedAt ?? null;
  const resolvedOutcomeLabel =
    question.resolvedOutcome === "yes" ? "Ja" : question.resolvedOutcome === "no" ? "Nein" : null;

  const resolvedOptionLabel =
    answerMode === "options" && question.resolvedOptionId
      ? options.find((o) => o.id === question.resolvedOptionId)?.label ?? "Option"
      : null;
  const resolvedLabel = resolvedOutcomeLabel ?? resolvedOptionLabel;

  const votedLabel =
    answerMode === "options"
      ? question.userOptionId
        ? (() => {
            const label = options.find((o) => o.id === question.userOptionId)?.label;
            return label ? `Du hast \"${label}\" gewählt` : "Du hast abgestimmt";
          })()
        : null
      : question.userChoice === "yes"
        ? "Du hast Ja gestimmt"
        : question.userChoice === "no"
          ? "Du hast Nein gestimmt"
          : null;

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL?.trim() ||
    (process.env.NODE_ENV === "production" ? "https://www.future-vote.de" : "http://localhost:3000");
  const shareUrl = `${baseUrl}/questions/${encodeURIComponent(id)}`;
  const widgetUrl = `${baseUrl}/widget/question/${encodeURIComponent(id)}`;

  return (
    <main className="page-enter min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto max-w-4xl px-4 pb-12 pt-8 sm:pt-10 lg:px-6">
        <QuestionViewTracker questionId={id} />
        <SmartBackButton
          fallbackHref={backHref}
          label={backLabel}
        />

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
              {answerMode === "binary" ? (
                <>
                  <span className="rounded-full bg-white/5 px-3 py-1">
                    {question.yesPct}% Ja ({yesVotes})
                  </span>
                  <span className="rounded-full bg-white/5 px-3 py-1">
                    {question.noPct}% Nein ({noVotes})
                  </span>
                </>
              ) : (
                <>
                  {options
                    .slice()
                    .sort((a, b) => (b.votesCount ?? 0) - (a.votesCount ?? 0))
                    .slice(0, 3)
                    .map((opt) => (
                      <span key={opt.id} className="rounded-full bg-white/5 px-3 py-1">
                        {(opt.pct ?? 0)}% {opt.label} ({opt.votesCount ?? 0})
                      </span>
                    ))}
                </>
              )}
              <span className="rounded-full bg-white/5 px-3 py-1">
                Insgesamt {totalVotes} Stimmen
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ShareLinkButton url={shareUrl} label="Teilen" action="share" />
              <EmbedWidgetButton widgetUrl={widgetUrl} title={question.title} />
              <ReportButton kind="question" itemId={id} itemTitle={question.title} shareId={question.shareId ?? null} />
            </div>
          </div>

          {isAdmin && (
            <div className="mt-4">
              <AdminControls
                questionId={id}
                isArchived={question.status === "archived"}
                answerMode={answerMode}
                isResolvable={isResolvable}
                resolvedOutcome={question.resolvedOutcome ?? null}
                resolvedOptionId={question.resolvedOptionId ?? null}
                options={options}
              />
            </div>
          )}
        </header>

        {question.resolvedOutcome === "yes" || question.resolvedOutcome === "no" ? (
          <div className="mt-6 sm:mt-8">
            <ResolvedSuccessCard
              title={question.title}
              url={shareUrl}
              resolvedOutcome={question.resolvedOutcome}
              yesVotes={yesVotes}
              noVotes={noVotes}
              userChoice={question.userChoice === "yes" || question.userChoice === "no" ? question.userChoice : null}
            />
          </div>
        ) : null}

        {isResolvable ? (
          <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-emerald-500/15 sm:mt-8 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-base font-semibold text-white">Auflösung</h3>
              {resolvedLabel ? (
                <span className="rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-50">
                  Entschieden: {resolvedLabel}
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                  Ausstehend
                </span>
              )}
            </div>

            {question.resolutionCriteria ? (
              <p className="mt-3 text-sm text-slate-200 sm:text-base">{question.resolutionCriteria}</p>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Noch keine Auflösungs-Regeln hinterlegt.</p>
            )}

            <div className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {question.resolutionSource ? (
                <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Quelle</p>
                  <div className="mt-1 min-w-0">
                    {/^https?:\/\//i.test(question.resolutionSource) ? (
                      <a
                        href={question.resolutionSource}
                        target="_blank"
                        rel="noreferrer"
                        className="block max-w-full break-all [overflow-wrap:anywhere] font-semibold text-emerald-100 hover:text-emerald-200"
                      >
                        {question.resolutionSource}
                      </a>
                    ) : (
                      <span className="font-semibold text-slate-100">{question.resolutionSource}</span>
                    )}
                  </div>
                </div>
              ) : null}

              {resolutionDeadlineLabel ? (
                <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Deadline</p>
                  <p className="mt-1 font-semibold text-slate-100">{resolutionDeadlineLabel}</p>
                </div>
              ) : null}

              {resolvedAtLabel ? (
                <div className="min-w-0 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm text-slate-200">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Entschieden am</p>
                  <p className="mt-1 font-semibold text-slate-100">{resolvedAtLabel}</p>
                </div>
              ) : null}
            </div>

            {question.resolvedSource || question.resolvedNote ? (
              <div className="mt-4 min-w-0 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Ergebnis</p>
                {question.resolvedSource ? (
                  <p className="mt-1 break-all [overflow-wrap:anywhere] font-semibold text-slate-100">
                    {question.resolvedSource}
                  </p>
                ) : null}
                {question.resolvedNote ? (
                  <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-slate-200">
                    {question.resolvedNote}
                  </p>
                ) : null}
              </div>
            ) : null}

            {!resolvedLabel && ended && answerMode === "binary" ? (
              <CommunityResolutionProposals questionId={id} isLoggedIn={Boolean(currentUser)} canPost={Boolean(currentUser?.emailVerified)} />
            ) : null}
          </section>
        ) : null}

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-emerald-500/15 sm:mt-8 sm:p-6">
          <h3 className="text-base font-semibold text-white">Abstimmen</h3>
          <DetailVoteButtons
            className="mt-4 space-y-3"
            questionId={id}
            closesAt={question.closesAt}
            answerMode={answerMode}
            options={options}
            initialChoice={question.userChoice === "yes" || question.userChoice === "no" ? question.userChoice : null}
            initialOptionId={question.userOptionId ?? null}
          />
        </section>

        <section className="mt-6 grid gap-6 sm:mt-8 md:grid-cols-3">
          <div className="md:col-span-2 flex min-h-0 flex-col gap-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-emerald-500/15 sm:p-6">
            {answerMode === "binary" ? (
              <>
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
              </>
            ) : (
              <>
                <div className="flex items-center justify-between text-sm text-slate-200">
                  <span>Community stimmt ab</span>
                  <span className="font-semibold text-white">{totalVotes} Stimmen</span>
                </div>
                <div className="space-y-3">
                  {options.map((opt) => (
                    <div key={opt.id} className="space-y-1">
                      <div className="flex items-start gap-3 text-sm text-slate-200">
                        <span className="min-w-0 flex-1 whitespace-normal break-words leading-snug">
                          {opt.label}
                        </span>
                        <span className="shrink-0 font-semibold text-white">{opt.pct ?? 0}%</span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-500 ease-out"
                          style={{ width: `${opt.pct ?? 0}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="min-h-0 flex-1">
                  <TrendSparkline questionId={id} />
                </div>
              </>
            )}
          </div>

          <div className="space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-emerald-500/15 sm:p-6">
            <h3 className="text-sm font-semibold text-white">Meta &amp; Stats</h3>
            <div className="grid grid-cols-2 gap-3">
              <StatsCard
                label="Votes (absolut)"
                value={totalVotes.toString()}
                hint={
                  answerMode === "binary"
                    ? `Ja ${yesVotes} / Nein ${noVotes}`
                    : options.map((opt) => `${opt.label}: ${opt.votesCount ?? 0}`).join(" · ")
                }
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

        <CommentsSection questionId={id} isLoggedIn={Boolean(currentUser)} canPost={Boolean(currentUser?.emailVerified)} />
      </div>
    </main>
  );
}
