import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DirectImage } from "@/app/components/DirectImage";
import { getQuestionsPageFromSupabase, type QuestionWithVotes } from "@/app/data/dbSupabase";
import { getShortDescription } from "@/app/lib/descriptionText";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 18;
const SITE_URL = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de";

type QuestionsSearchParams = Record<string, string | string[] | undefined>;

function parsePage(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const parsed = Number.parseInt(raw ?? "1", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function pageHref(page: number): string {
  return page <= 1 ? "/questions" : `/questions?page=${page}`;
}

function clampText(value: string, maxLength: number): string {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`;
}

function formatDate(value: string): string {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return value;
  return new Date(timestamp).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function totalVotes(question: QuestionWithVotes): number {
  if (question.answerMode === "options") {
    return (question.options ?? []).reduce((sum, option) => sum + Math.max(0, option.votesCount ?? 0), 0);
  }
  return Math.max(0, (question.yesVotes ?? 0) + (question.noVotes ?? 0));
}

function questionSummary(question: QuestionWithVotes): string {
  const description = getShortDescription(question.description);
  return clampText(description || question.summary || "Aktuelle öffentliche Abstimmung auf FutureVote.", 220);
}

export async function generateMetadata(props: {
  searchParams?: Promise<QuestionsSearchParams> | QuestionsSearchParams;
}): Promise<Metadata> {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const page = parsePage(searchParams.page);
  const canonical = pageHref(page);
  const pageSuffix = page > 1 ? `, Seite ${page}` : "";
  const title = `Aktuelle Umfragen und Prognosen${pageSuffix} - FutureVote`;
  const description =
    "Entdecke aktuelle öffentliche Meinungs-Umfragen und Prognosen auf FutureVote und stimme direkt mit ab.";

  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    alternates: { canonical },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "FutureVote Umfragen" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ["/opengraph-image"],
    },
  };
}

export default async function QuestionsIndexPage(props: {
  searchParams?: Promise<QuestionsSearchParams>;
}) {
  const searchParams = props.searchParams ? await props.searchParams : {};
  const page = parsePage(searchParams.page);
  const offset = (page - 1) * PAGE_SIZE;
  const result = await getQuestionsPageFromSupabase({
    limit: PAGE_SIZE,
    offset,
    voted: "include",
    tab: "directory",
  });
  const totalPages = Math.max(1, Math.ceil(result.total / PAGE_SIZE));

  if (page > totalPages && result.total > 0) notFound();

  return (
    <main className="page-enter min-h-screen text-slate-50">
      <div className="mx-auto w-full max-w-6xl px-3 pb-12 pt-5 sm:px-6 sm:pt-8">
        <nav aria-label="Brotkrumen" className="text-xs text-slate-400">
          <Link href="/" className="hover:text-emerald-100">
            Startseite
          </Link>
          <span aria-hidden="true" className="px-2">
            /
          </span>
          <span className="text-slate-200">Umfragen</span>
        </nav>

        <header className="mt-4 border-b border-white/10 pb-5 sm:pb-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-200/80">FutureVote</p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight text-white sm:text-3xl">
                Aktuelle Umfragen und Prognosen
              </h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                Öffentliche Fragen aus Politik, Wirtschaft, Gesellschaft, Technik und weiteren Themen. Die neuesten
                Fragen stehen zuerst.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-2.5 text-emerald-50 hover:bg-emerald-500/25"
              >
                Direkt abstimmen
              </Link>
              <Link
                href="/archiv"
                className="inline-flex items-center justify-center rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-slate-100 hover:border-emerald-200/30"
              >
                Beendete Umfragen
              </Link>
            </div>
          </div>
        </header>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-300">
          <h2 className="font-semibold text-white">{result.total} aktive öffentliche Fragen</h2>
          <span>
            Seite {page} von {totalPages}
          </span>
        </div>

        {result.items.length === 0 ? (
          <section className="mt-5 border-y border-white/10 py-8 text-sm text-slate-300">
            <h2 className="font-semibold text-white">Derzeit keine aktive öffentliche Frage</h2>
            <p className="mt-2">Beendete Fragen und ihre Ergebnisse findest du im Archiv.</p>
          </section>
        ) : (
          <section aria-label="Öffentliche Umfragen" className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {result.items.map((question) => {
              const votes = totalVotes(question);
              const isOpinion = question.isResolvable === false;
              return (
                <article
                  key={question.id}
                  className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-white/5 shadow-lg shadow-black/20 transition hover:border-emerald-200/35 hover:bg-white/[0.07]"
                >
                  {question.imageUrl ? (
                    <Link
                      href={`/questions/${encodeURIComponent(question.id)}`}
                      className="flex aspect-[16/9] w-full items-center justify-center overflow-hidden border-b border-white/10 bg-black/25"
                      aria-label={`${question.title} öffnen`}
                    >
                      <DirectImage
                        src={question.imageUrl}
                        alt={question.title}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    </Link>
                  ) : null}

                  <div className="flex flex-1 flex-col p-4">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold">
                      <span
                        className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1"
                        style={{ backgroundColor: `${question.categoryColor}22`, color: question.categoryColor }}
                      >
                        <span aria-hidden="true">{question.categoryIcon}</span>
                        <span className="text-slate-50">{question.category}</span>
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-1 ${
                          isOpinion
                            ? "border-amber-300/25 bg-amber-500/10 text-amber-100"
                            : "border-indigo-300/25 bg-indigo-500/10 text-indigo-100"
                        }`}
                      >
                        {isOpinion ? "Meinungs-Umfrage" : "Prognose"}
                      </span>
                    </div>

                    <h2 className="card-title-wrap mt-3 text-base font-semibold leading-snug text-white">
                      <Link href={`/questions/${encodeURIComponent(question.id)}`} className="hover:text-emerald-100">
                        {question.title}
                      </Link>
                    </h2>
                    <p className="mt-2 line-clamp-4 text-sm leading-5 text-slate-300">{questionSummary(question)}</p>

                    <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs">
                      <span className="text-slate-400">
                        {votes} {votes === 1 ? "Stimme" : "Stimmen"} · bis {formatDate(question.closesAt)}
                      </span>
                      <Link
                        href={`/questions/${encodeURIComponent(question.id)}`}
                        className="font-semibold text-emerald-100 hover:text-emerald-200"
                      >
                        Zur Umfrage →
                      </Link>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {totalPages > 1 ? (
          <nav aria-label="Seitennavigation" className="mt-7 flex items-center justify-between border-t border-white/10 pt-5">
            {page > 1 ? (
              <Link
                rel="prev"
                href={pageHref(page - 1)}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-slate-100 hover:border-emerald-200/30"
              >
                ← Vorherige Seite
              </Link>
            ) : (
              <span />
            )}
            {page < totalPages ? (
              <Link
                rel="next"
                href={pageHref(page + 1)}
                className="rounded-lg border border-emerald-300/35 bg-emerald-500/15 px-4 py-2.5 text-sm font-semibold text-emerald-50 hover:bg-emerald-500/25"
              >
                Nächste Seite →
              </Link>
            ) : null}
          </nav>
        ) : null}
      </div>
    </main>
  );
}
