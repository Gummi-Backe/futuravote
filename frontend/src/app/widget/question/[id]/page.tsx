import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getQuestionByIdFromSupabase } from "@/app/data/dbSupabase";

export const revalidate = 60;

function getMetadataBaseUrl() {
  return process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de";
}

export async function generateMetadata(props: {
  params: Promise<{ id: string }> | { id: string };
}): Promise<Metadata> {
  const resolvedParams = await (props as any).params;
  const id = (resolvedParams?.id as string) ?? "";
  const metadataBase = new URL(getMetadataBaseUrl());

  return {
    metadataBase,
    title: "Future-Vote Widget",
    description: "Einbettbares Widget mit dem aktuellen Stand einer Prognosefrage.",
    robots: { index: false, follow: false },
    alternates: { canonical: `/widget/question/${encodeURIComponent(id)}` },
  };
}

function VoteBar({ yesPct, noPct }: { yesPct: number; noPct: number }) {
  return (
    <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
      <div className="h-full bg-emerald-400" style={{ width: `${yesPct}%` }} />
      <div className="absolute right-0 top-0 h-full bg-rose-400" style={{ width: `${noPct}%` }} />
    </div>
  );
}

export default async function QuestionWidgetPage(props: { params: Promise<{ id: string }> }) {
  const resolvedParams = await props.params;
  const id = resolvedParams.id;

  const question = await getQuestionByIdFromSupabase(id).catch(() => null);
  if (!question || question.visibility !== "public") notFound();

  const totalVotes = (question.yesVotes ?? 0) + (question.noVotes ?? 0);
  const yesPct = question.yesPct ?? 0;
  const noPct = question.noPct ?? 0;

  return (
    <main className="min-h-[280px] w-full bg-transparent p-0 text-slate-100">
      <style>{`
        [data-fv-help="1"],
        .fv-site-footer {
          display: none !important;
        }
        html,
        body {
          background: transparent !important;
        }
      `}</style>
      <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-4 shadow-2xl shadow-emerald-500/15 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold tracking-wide text-slate-300">
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-xl border border-emerald-200/25 bg-emerald-500/15 text-[11px] font-bold text-emerald-50">
                  FV
                </span>
                Future-Vote
              </span>
              <span className="opacity-70">•</span>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1">
                <span aria-hidden="true">{question.categoryIcon}</span>
                <span className="truncate">{question.category}</span>
              </span>
              {question.region ? (
                <span className="inline-flex items-center rounded-full border border-white/10 bg-white/5 px-3 py-1">
                  {question.region}
                </span>
              ) : null}
            </div>

            <h1 className="mt-3 line-clamp-2 text-lg font-bold leading-snug text-white sm:text-xl">
              {question.title}
            </h1>
          </div>

          {question.imageUrl ? (
            <div className="flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/30">
              <img
                src={question.imageUrl}
                alt=""
                className="h-16 w-16 object-cover sm:h-20 sm:w-20"
                loading="lazy"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-200">
            <span className="font-semibold text-white">
              {yesPct}% Ja · {noPct}% Nein
            </span>
            <span className="text-slate-300">{totalVotes} Stimmen</span>
          </div>
          <VoteBar yesPct={yesPct} noPct={noPct} />
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Link
            href={`/questions/${encodeURIComponent(id)}`}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200/25 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-50 transition hover:bg-emerald-500/25"
          >
            Zur Frage
            <span aria-hidden="true">→</span>
          </Link>

          <span className="text-[11px] text-slate-400">Widget • Stand kann bis zu 60s verzögert sein</span>
        </div>
      </div>
    </main>
  );
}
