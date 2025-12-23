import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import type { Metadata } from "next";
import type { Draft, Question } from "@/app/data/mock";
import { ShareLinkButton } from "@/app/components/ShareLinkButton";
import { SmartBackButton } from "@/app/components/SmartBackButton";
import { DetailVoteButtons } from "@/app/questions/[id]/DetailVoteButtons";
import { TrendSparkline } from "@/app/questions/[id]/TrendSparkline";
import { DraftReviewClient } from "./DraftReviewClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { ReportButton } from "@/app/components/ReportButton";
import { getPollByShareIdFromSupabase } from "@/app/data/dbSupabase";

export const dynamic = "force-dynamic";

type SharedPollResponse =
  | { kind: "question"; question: Question; shareId: string }
  | { kind: "draft"; draft: Draft; shareId: string; alreadyReviewed: boolean };

function getMetadataBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de";
}

function clampText(value: string, maxLen: number) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (trimmed.length <= maxLen) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
}

export async function generateMetadata(props: {
  params: Promise<{ shareId: string }> | { shareId: string };
}): Promise<Metadata> {
  const resolvedParams = await (props as any).params;
  const shareId = (resolvedParams?.shareId as string) ?? "";

  const metadataBase = new URL(getMetadataBaseUrl());
  const canonical = `/p/${encodeURIComponent(shareId)}`;

  const poll = await getPollByShareIdFromSupabase({ shareId }).catch(() => null);
  if (!poll) {
    return {
      metadataBase,
      title: "Umfrage nicht gefunden - Future-Vote",
      robots: { index: false, follow: false },
    };
  }

  const titleBase = poll.kind === "question" ? poll.question.title : poll.draft.title;
  const title = `${titleBase} - Future-Vote`;
  const descriptionBase =
    poll.kind === "question"
      ? poll.question.description?.trim() ||
        `Private Umfrage in ${poll.question.category}${poll.question.region ? ` · ${poll.question.region}` : ""}.`
      : poll.draft.description?.trim() ||
        `Private Umfrage in ${poll.draft.category}${poll.draft.region ? ` · ${poll.draft.region}` : ""}.`;
  const description = clampText(descriptionBase, 180);

  const imageUrl =
    (poll.kind === "question" ? poll.question.imageUrl : poll.draft.imageUrl)?.trim() || "/opengraph-image";

  return {
    metadataBase,
    title,
    description,
    alternates: { canonical },
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [{ url: imageUrl, width: 1200, height: 630, alt: titleBase }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

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

async function fetchSharedPoll(shareId: string): Promise<SharedPollResponse | null> {
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.get("fv_session")?.value;
  const baseUrl = await getBaseUrl();

  try {
    const res = await fetch(`${baseUrl}/api/polls/${encodeURIComponent(shareId)}`, {
      cache: "no-store",
      headers: cookieHeader ? { cookie: `fv_session=${cookieHeader}` } : undefined,
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return (await res.json()) as SharedPollResponse;
  } catch {
    return null;
  }
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

export default async function SharedPollPage(props: {
  params: Promise<{ shareId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await props.params;
  const shareId = resolvedParams.shareId;

  const resolvedSearchParams = props.searchParams ? await props.searchParams : {};
  const fromParam = resolvedSearchParams?.from;
  const from = Array.isArray(fromParam) ? fromParam[0] : fromParam;
  const cameFromAdminReports = from === "admin_reports";
  const cameFromAdminResolutions = from === "admin_resolutions";

  const poll = await fetchSharedPoll(shareId);
  if (!poll) notFound();

  const sharedQuestion = poll.kind === "question" ? poll.question : null;
  const answerMode = sharedQuestion?.answerMode ?? "binary";
  const isOptions = answerMode === "options";
  const options = sharedQuestion?.options ?? [];
  const optionsTotalVotes = isOptions
    ? options.reduce((sum, opt) => sum + Math.max(0, opt.votesCount ?? 0), 0)
    : 0;
  const yesVotes = !isOptions ? sharedQuestion?.yesVotes ?? 0 : 0;
  const noVotes = !isOptions ? sharedQuestion?.noVotes ?? 0 : 0;
  const totalVotes = isOptions ? optionsTotalVotes : yesVotes + noVotes;

  const cookieStore = await cookies();
  const userSessionId = cookieStore.get("fv_user")?.value;
  const currentUser = userSessionId ? await getUserBySessionSupabase(userSessionId).catch(() => null) : null;
  const isAdmin = currentUser?.role === "admin";

  const baseUrl = await getBaseUrl();
  const shareUrl = `${baseUrl}/p/${encodeURIComponent(shareId)}`;

  const ownerId =
    poll.kind === "question" ? poll.question.creatorId ?? null : poll.draft.creatorId ?? null;
  const isOwner = Boolean(currentUser?.id && ownerId && currentUser.id === ownerId);
  const backFallbackHref =
    isAdmin && cameFromAdminReports
      ? "/admin/reports"
      : isAdmin && cameFromAdminResolutions
        ? "/admin/resolutions"
        : isOwner
          ? "/profil?tab=private"
          : "/";
  const backLabel =
    isAdmin && cameFromAdminReports
      ? "← Zurück zu Meldungen"
      : isAdmin && cameFromAdminResolutions
        ? "← Zurück zu Auflösungen"
        : isOwner
          ? "← Zurück zum Profil"
          : "← Zurück";

  return (
    <main className="page-enter min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 px-4 pb-12 pt-8 text-slate-100 sm:px-6 sm:pt-10">
      <div className="mx-auto w-full max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SmartBackButton
            fallbackHref={backFallbackHref}
            label={backLabel}
            className="text-sm text-slate-200 hover:text-white bg-transparent p-0"
          />
        </div>

        {isOwner ? (
          <section className="mt-4 rounded-3xl border border-emerald-300/30 bg-emerald-500/10 p-4 shadow-xl shadow-emerald-500/15 sm:p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-50">
                  Privat (nur per Link)
                </span>
                <p className="text-sm text-emerald-50/90">
                  Teile den Link. Nur du siehst diesen Hinweis - alle anderen koennen nur abstimmen.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap sm:justify-end">
                <div className="flex flex-col items-center gap-1">
                  <ShareLinkButton
                    url={shareUrl}
                    label="Teilen"
                    variant="icon"
                    action="share"
                    className="h-11 w-11 border-emerald-300/60 bg-emerald-500/20 text-white hover:bg-emerald-500/30"
                  />
                  <span className="text-[11px] font-semibold text-emerald-50/90">Teilen</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <ShareLinkButton url={shareUrl} label="Link kopieren" variant="icon" action="copy" className="h-11 w-11" />
                  <span className="text-[11px] font-semibold text-emerald-50/90">Link</span>
                </div>
                <div className="flex flex-col items-center gap-1">
                  <a
                    href={`mailto:?subject=${encodeURIComponent(
                      "Private Umfrage (Future-Vote)"
                    )}&body=${encodeURIComponent(
                      `Hier ist der Link zur Umfrage:\r\n\r\n${shareUrl}\r\n\r\nFalls der Link nicht klickbar ist: bitte die ganze Zeile kopieren und im Browser einfuegen.\r\n`
                    )}`}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-200/40"
                    aria-label="Per E-Mail senden"
                    title="Per E-Mail senden"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
                      <path
                        d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-9Z"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M5.5 7.5 12 12l6.5-4.5"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                  <span className="text-[11px] font-semibold text-emerald-50/90">E-Mail</span>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {poll.kind === "draft" ? (
          <section className="mt-6 space-y-3">
            {isOwner ? (
              <p className="max-w-xl text-sm text-slate-300">
                Diese Umfrage ist nicht im Feed gelistet. Jeder mit diesem Link kann sie bewerten.
              </p>
            ) : null}
            {!isOwner ? (
              <div className="flex flex-wrap items-center gap-2">
                <ReportButton kind="draft" itemId={poll.draft.id} itemTitle={poll.draft.title} shareId={shareId} />
              </div>
            ) : null}
            <DraftReviewClient
              initialDraft={poll.draft}
              alreadyReviewedInitial={poll.alreadyReviewed}
              readOnly={isOwner}
            />
          </section>
        ) : (
          <section className="mt-6 grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-emerald-500/15 sm:p-6">
              <div className="flex items-start gap-3">
                {poll.question.imageUrl ? (
                  <div className="inline-flex max-h-20 max-w-[5.5rem] flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-black/30 sm:max-h-24 sm:max-w-[7rem]">
                    <img
                      src={poll.question.imageUrl}
                      alt={poll.question.title}
                      className="h-auto w-auto max-h-20 max-w-[5.5rem] object-contain sm:max-h-24 sm:max-w-[7rem]"
                      loading="lazy"
                    />
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-bold leading-tight text-white sm:text-3xl">
                    {poll.question.title}
                  </h1>
                  {poll.question.imageCredit ? (
                    <p className="mt-1 text-xs text-slate-400">{poll.question.imageCredit}</p>
                  ) : null}
                </div>
              </div>

              {poll.question.description ? (
                <p className="text-sm text-slate-200 sm:text-base">{poll.question.description}</p>
              ) : null}

              {isOptions ? (
                <>
                  <div className="flex items-center justify-between text-sm text-slate-200">
                    <span>Community stimmt ab</span>
                    <span className="font-semibold text-white">{totalVotes} Stimmen</span>
                  </div>
                  <div className="space-y-3">
                    {options.map((opt) => (
                      <div key={opt.id} className="space-y-1">
                        <div className="flex items-center justify-between gap-3 text-sm text-slate-200">
                          <span className="min-w-0 truncate">{opt.label}</span>
                          <span className="shrink-0 font-semibold text-white">{opt.pct ?? 0}%</span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                          <div className="h-full bg-emerald-400" style={{ width: `${opt.pct ?? 0}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between text-sm text-slate-200">
                    <span>Community glaubt</span>
                    <span className="font-semibold text-white">
                      {poll.question.yesPct}% Ja · {poll.question.noPct}% Nein
                    </span>
                  </div>
                  <VoteBar yesPct={poll.question.yesPct} noPct={poll.question.noPct} />
                  <TrendSparkline questionId={poll.question.id} />
                </>
              )}
            </div>

            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-emerald-500/15 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
                {!isOptions ? (
                  <>
                    <span className="rounded-full bg-white/5 px-3 py-1">
                      {poll.question.yesPct}% Ja ({poll.question.yesVotes ?? 0})
                    </span>
                    <span className="rounded-full bg-white/5 px-3 py-1">
                      {poll.question.noPct}% Nein ({poll.question.noVotes ?? 0})
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

              {isOwner ? (
                <p className="text-xs text-slate-400">
                  Diese Umfrage ist nicht im Feed gelistet. Jeder mit diesem Link kann abstimmen.
                </p>
              ) : null}

              <div className="pt-2">
                {!isOwner ? (
                  <ReportButton
                    kind="question"
                    itemId={poll.question.id}
                    itemTitle={poll.question.title}
                    shareId={shareId}
                    className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-rose-200/40 sm:w-auto"
                  />
                ) : null}
              </div>
            </div>

            {!isOwner ? (
              <div className="lg:col-span-3">
                <DetailVoteButtons
                  questionId={poll.question.id}
                  closesAt={poll.question.closesAt}
                  answerMode={answerMode}
                  options={options}
                  initialChoice={
                    poll.question.userChoice === "yes" || poll.question.userChoice === "no"
                      ? poll.question.userChoice
                      : null
                  }
                  initialOptionId={poll.question.userOptionId ?? null}
                />
              </div>
            ) : null}
          </section>
        )}
      </div>
    </main>
  );
}
