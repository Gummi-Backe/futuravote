import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies, headers } from "next/headers";
import type { Draft, Question } from "@/app/data/mock";
import { ShareLinkButton } from "@/app/components/ShareLinkButton";
import { SmartBackButton } from "@/app/components/SmartBackButton";
import { DetailVoteButtons } from "@/app/questions/[id]/DetailVoteButtons";
import { TrendSparkline } from "@/app/questions/[id]/TrendSparkline";
import { DraftReviewClient } from "./DraftReviewClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const dynamic = "force-dynamic";

type SharedPollResponse =
  | { kind: "question"; question: Question; shareId: string }
  | { kind: "draft"; draft: Draft; shareId: string; alreadyReviewed: boolean };

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

export default async function SharedPollPage(props: { params: Promise<{ shareId: string }> }) {
  const resolvedParams = await props.params;
  const shareId = resolvedParams.shareId;

  const poll = await fetchSharedPoll(shareId);
  if (!poll) notFound();

  const cookieStore = await cookies();
  const userSessionId = cookieStore.get("fv_user")?.value;
  const currentUser = userSessionId ? await getUserBySessionSupabase(userSessionId).catch(() => null) : null;

  const baseUrl = await getBaseUrl();
  const shareUrl = `${baseUrl}/p/${encodeURIComponent(shareId)}`;

  const ownerId =
    poll.kind === "question" ? poll.question.creatorId ?? null : poll.draft.creatorId ?? null;
  const isOwner = Boolean(currentUser?.id && ownerId && currentUser.id === ownerId);
  const backFallbackHref = isOwner ? "/profil?tab=private" : "/";

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SmartBackButton
            fallbackHref={backFallbackHref}
            label={isOwner ? "← Zurück zum Profil" : "← Zurück"}
            className="text-sm text-slate-200 hover:text-white bg-transparent p-0"
          />
        </div>

        {isOwner ? (
          <section className="mt-4 rounded-3xl border border-emerald-300/30 bg-emerald-500/10 p-4 shadow-xl shadow-emerald-500/15">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-300/40 bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-50">
                    Privat (nur per Link)
                  </span>
                </div>
                <p className="text-sm text-emerald-50/90">
                  Teile den Link mit Freunden. Nur du siehst diesen Hinweis - alle anderen koennen nur abstimmen.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ShareLinkButton url={shareUrl} label="Teilen" variant="primary" action="share" />
                <ShareLinkButton url={shareUrl} label="Link kopieren" action="copy" />
                <a
                  href={`mailto:?subject=${encodeURIComponent(
                    "Private Umfrage (Future-Vote)"
                  )}&body=${encodeURIComponent(
                    `Hier ist der Link zur Umfrage:\r\n\r\n${shareUrl}\r\n\r\nFalls der Link nicht klickbar ist: bitte die ganze Zeile kopieren und im Browser einfuegen.\r\n`
                  )}`}
                  className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-200/40"
                >
                  Per E-Mail senden
                </a>
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
            <DraftReviewClient initialDraft={poll.draft} alreadyReviewedInitial={poll.alreadyReviewed} />
          </section>
        ) : (
          <section className="mt-6 grid gap-6 md:grid-cols-3">
            <div className="md:col-span-2 space-y-4 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-emerald-500/15 sm:p-6">
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
                <div className="flex-1">
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

              <div className="flex items-center justify-between text-sm text-slate-200">
                <span>Community glaubt</span>
                <span className="font-semibold text-white">
                  {poll.question.yesPct}% Ja · {poll.question.noPct}% Nein
                </span>
              </div>
              <VoteBar yesPct={poll.question.yesPct} noPct={poll.question.noPct} />

              <TrendSparkline questionId={poll.question.id} />
            </div>

            <div className="space-y-3 rounded-3xl border border-white/10 bg-white/5 p-4 shadow-xl shadow-emerald-500/15 sm:p-6">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-200">
                <span className="rounded-full bg-white/5 px-3 py-1">
                  {poll.question.yesPct}% Ja ({poll.question.yesVotes ?? 0})
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1">
                  {poll.question.noPct}% Nein ({poll.question.noVotes ?? 0})
                </span>
                <span className="rounded-full bg-white/5 px-3 py-1">
                  Insgesamt {(poll.question.yesVotes ?? 0) + (poll.question.noVotes ?? 0)} Stimmen
                </span>
              </div>

              {isOwner ? (
                <p className="text-xs text-slate-400">
                  Diese Umfrage ist nicht im Feed gelistet. Jeder mit diesem Link kann abstimmen.
                </p>
              ) : null}
            </div>

            <div className="md:col-span-3">
              <DetailVoteButtons
                questionId={poll.question.id}
                initialChoice={
                  poll.question.userChoice === "yes" || poll.question.userChoice === "no" ? poll.question.userChoice : null
                }
              />
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
