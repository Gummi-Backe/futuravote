import Link from "next/link";
import type { Metadata } from "next";
import { SmartBackButton } from "@/app/components/SmartBackButton";
import { CategorySelectorRowClient } from "@/app/rangliste/CategorySelectorRowClient";
import {
  type CommunityLeaderRow,
  type LeaderboardView,
  type TrefferLeaderRow,
  getCommunityLeaderboard,
  getTrefferLeaderboard,
} from "@/app/data/leaderboards";

export const revalidate = 30;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de"),
  title: "Rangliste - Future-Vote",
  description: "Rangliste für Treffer (richtige Prognosen) und Community‑Beiträge auf Future‑Vote.",
  alternates: { canonical: "/rangliste" },
};

function medalForRankNumber(rank: number): { shortLabel: "G" | "S" | "B"; title: string; className: string } | null {
  if (rank === 1) return { shortLabel: "G", title: "Gold", className: "bg-amber-500/20 text-amber-200" };
  if (rank === 2) return { shortLabel: "S", title: "Silber", className: "bg-slate-400/20 text-slate-200" };
  if (rank === 3) return { shortLabel: "B", title: "Bronze", className: "bg-orange-500/20 text-orange-200" };
  return null;
}

function computeCompetitionRanks<T>(rows: T[], getPoints: (row: T) => number): number[] {
  let lastPoints: number | null = null;
  let lastRank = 0;
  return rows.map((row, index) => {
    const points = getPoints(row);
    if (lastPoints !== null && points === lastPoints) return lastRank;
    const rank = index + 1;
    lastPoints = points;
    lastRank = rank;
    return rank;
  });
}

function formatCompactCell(value: number): string {
  const n = Number.isFinite(value) ? Math.round(value) : 0;
  const abs = Math.abs(n);
  if (abs < 10000) return String(n);
  if (abs < 1000000) return `${Math.round(n / 1000)}k`;
  return `${Math.round(n / 1000000)}m`;
}

function TrefferLeaderboardPanel({
  category,
  days,
  minSamples,
  resolvedCount,
  leaders,
  ranks,
}: {
  category: string;
  days: number;
  minSamples: number;
  resolvedCount: number;
  leaders: TrefferLeaderRow[];
  ranks: number[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">Treffer · Top {leaders.length} {category === "all" ? "gesamt" : category}</p>
        <p className="text-xs text-slate-300">
          Zeitraum: letzte {days} Tage <span className="text-slate-500">·</span> Sortiert nach richtigen Tipps
        </p>
      </div>

      {resolvedCount === 0 ? (
        <p className="mt-4 text-sm text-slate-300">
          Noch keine aufgelösten Fragen im gewählten Zeitraum. Sobald erste Fragen entschieden sind, erscheint hier die Rangliste.
        </p>
      ) : leaders.length === 0 ? (
        <p className="mt-4 text-sm text-slate-300">
          Noch keine Nutzer mit mindestens {minSamples} entschiedenen Fragen im gewählten Zeitraum.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full table-fixed text-left text-xs sm:text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-300">
              <tr>
                <th className="w-6 px-0.5 py-3 text-center whitespace-nowrap sm:px-1" title="Rang">
                  #
                </th>
                <th className="px-1 py-3 whitespace-nowrap sm:px-2" title="Nutzer">
                  👤 Nutzer
                </th>
                <th className="w-9 px-0.5 py-3 text-right whitespace-nowrap sm:w-10 sm:px-1" title="Richtig">
                  ✅
                </th>
                <th className="w-9 px-0.5 py-3 text-right whitespace-nowrap sm:w-10 sm:px-1" title="Falsch">
                  ❌
                </th>
                <th className="w-9 px-0.5 py-3 text-right whitespace-nowrap sm:w-10 sm:px-1" title="Trefferquote">
                  🎯
                </th>
                <th className="w-9 px-0.5 py-3 text-right whitespace-nowrap sm:w-10 sm:px-1" title="Punkte">
                  ⭐
                </th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((row, idx) => {
                const rank = ranks[idx] ?? idx + 1;
                const medal = medalForRankNumber(rank);
                return (
                  <tr key={row.userId} className="border-t border-white/10">
                    <td className="px-0.5 py-3 text-center font-semibold text-slate-200 sm:px-1">{rank}</td>
                    <td className="px-1 py-3 sm:px-2">
                      <div className="flex items-center gap-2">
                        <span className="max-w-full truncate text-white" title={row.displayName}>
                          {row.displayName}
                        </span>
                        {medal ? (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${medal.className}`}>
                            <span title={medal.title}>{medal.shortLabel}</span>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-0.5 py-3 text-right font-semibold text-emerald-200 sm:px-1">{formatCompactCell(row.correct)}</td>
                    <td className="px-0.5 py-3 text-right font-semibold text-rose-200 sm:px-1">{formatCompactCell(row.incorrect)}</td>
                    <td className="px-0.5 py-3 text-right font-semibold text-slate-100 sm:px-1">
                      {Math.max(0, Math.min(100, Math.round(row.accuracyPct)))}%
                    </td>
                    <td className="px-0.5 py-3 text-right font-semibold text-slate-100 sm:px-1">{formatCompactCell(row.pointsTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CommunityLeaderboardPanel({
  category,
  leaders,
  ranks,
}: {
  category: string;
  leaders: CommunityLeaderRow[];
  ranks: number[];
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">Community · Top {leaders.length} {category === "all" ? "gesamt" : category}</p>
        <p className="text-xs text-slate-300">
          Sortiert nach Community‑Punkten <span className="text-slate-500">·</span> Nur eingeloggte Nutzer
        </p>
      </div>

      {leaders.length === 0 ? (
        <p className="mt-4 text-sm text-slate-300">
          Noch keine Community‑Beiträge im gewählten Filter. Sobald Nutzer Kommentare schreiben oder Vorschläge angenommen werden,
          erscheint hier die Rangliste.
        </p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full table-fixed text-left text-xs sm:text-sm">
            <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-300">
              <tr>
                <th className="w-6 px-0.5 py-3 text-center whitespace-nowrap sm:px-1" title="Rang">
                  #
                </th>
                <th className="px-1 py-3 whitespace-nowrap sm:px-2" title="Nutzer">
                  👤 Nutzer
                </th>
                <th className="w-9 px-0.5 py-3 text-right whitespace-nowrap sm:w-10 sm:px-1" title="Angenommene Vorschläge">
                  <span aria-hidden>✅</span>
                  <span className="sr-only">Angenommene Vorschläge</span>
                </th>
                <th className="w-9 px-0.5 py-3 text-right whitespace-nowrap sm:w-10 sm:px-1" title="Kommentare">
                  <span aria-hidden>💬</span>
                  <span className="sr-only">Kommentare</span>
                </th>
                <th className="w-9 px-0.5 py-3 text-right whitespace-nowrap sm:w-10 sm:px-1" title="Auflösungs-Vorschläge">
                  <span aria-hidden>🎯</span>
                  <span className="sr-only">Auflösungs-Vorschläge</span>
                </th>
                <th className="w-9 px-0.5 py-3 text-right whitespace-nowrap sm:w-10 sm:px-1" title="Community-Punkte">
                  <span aria-hidden>⭐</span>
                  <span className="sr-only">Community-Punkte</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {leaders.map((row, idx) => {
                const rank = ranks[idx] ?? idx + 1;
                const medal = medalForRankNumber(rank);
                return (
                  <tr key={row.userId} className="border-t border-white/10">
                    <td className="px-0.5 py-3 text-center font-semibold text-slate-200 sm:px-1">{rank}</td>
                    <td className="px-1 py-3 sm:px-2">
                      <div className="flex items-center gap-2">
                        <span className="max-w-full truncate text-white" title={row.displayName}>
                          {row.displayName}
                        </span>
                        {medal ? (
                          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${medal.className}`}>
                            <span title={medal.title}>{medal.shortLabel}</span>
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-0.5 py-3 text-right font-semibold text-slate-100 sm:px-1">{formatCompactCell(row.acceptedDrafts)}</td>
                    <td className="px-0.5 py-3 text-right font-semibold text-slate-100 sm:px-1">{formatCompactCell(row.comments)}</td>
                    <td className="px-0.5 py-3 text-right font-semibold text-slate-100 sm:px-1">{formatCompactCell(row.resolutionProposals)}</td>
                    <td className="px-0.5 py-3 text-right font-semibold text-slate-100 sm:px-1">{formatCompactCell(row.pointsTotal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default async function RanglistePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const view: LeaderboardView = sp.view === "community" ? "community" : "treffer";
  const days = 90;
  const category = (sp.category ?? "all").trim() || "all";
  const minSamples = 5;
  const limit = 25;

  const treffer = await getTrefferLeaderboard({ days, category, minSamples, limit });
  const communityLeaders = await getCommunityLeaderboard({ category, limit });
  const resolvedCount = treffer.resolvedCount;
  const trefferRanks = computeCompetitionRanks(treffer.leaders, (row) => row.pointsTotal);
  const communityRanks = computeCompetitionRanks(communityLeaders, (row) => row.pointsTotal);

  const makeHref = (next: { view?: LeaderboardView; category?: string }) => {
    const nextView = next.view ?? view;
    const nextCategory = next.category ?? category;
    const params = new URLSearchParams();
    if (nextView !== "treffer") params.set("view", nextView);
    if (nextCategory && nextCategory !== "all") params.set("category", nextCategory);
    const qs = params.toString();
    return qs ? `/rangliste?${qs}` : "/rangliste";
  };

  return (
    <main className="min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 lg:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <SmartBackButton fallbackHref="/" label="← Zurück" />
            <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Rangliste</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200 lg:hidden">
              {view === "treffer" ? (
                <>
                  Hier zählen nur <span className="font-semibold text-white">entschiedene</span> (aufgelöste) öffentliche Fragen.
                  <span className="text-slate-400"> · </span>
                  Mindestens {minSamples} entschiedene Fragen im Zeitraum, damit du gelistet wirst.
                </>
              ) : (
                <>
                  Hier zählen <span className="font-semibold text-white">Beiträge</span> zur Community: angenommene Vorschläge, Kommentare und
                  Auflösungs‑Vorschläge (bei Prognosen).
                </>
              )}
            </p>
            <p className="mt-2 hidden max-w-2xl text-sm text-slate-200 lg:block">
              Links siehst du die Treffer-Rangliste (richtige Prognosen), rechts die Community-Rangliste
              (angenommene Vorschläge, Kommentare und Auflösungs-Vorschläge).
            </p>

            <div className="mt-4 flex flex-wrap gap-2 lg:hidden">
              <Link
                href={makeHref({ view: "treffer" })}
                replace
                scroll={false}
                className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition ${
                  view === "treffer"
                    ? "border-emerald-300/60 bg-emerald-500/20 text-white hover:-translate-y-0.5"
                    : "border-white/10 bg-white/5 text-slate-100 hover:-translate-y-0.5 hover:border-emerald-200/40"
                }`}
              >
                Treffer
              </Link>
              <Link
                href={makeHref({ view: "community" })}
                replace
                scroll={false}
                className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition ${
                  view === "community"
                    ? "border-amber-200/60 bg-amber-500/20 text-white hover:-translate-y-0.5"
                    : "border-white/10 bg-white/5 text-slate-100 hover:-translate-y-0.5 hover:border-amber-200/40"
                }`}
              >
                Community
              </Link>
            </div>
          </div>
        </div>

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/10 p-4 shadow-2xl shadow-emerald-500/10 backdrop-blur sm:p-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Kategorie</span>
              <div className="min-w-0 flex-1">
                <CategorySelectorRowClient category={category} view={view} />
              </div>
              <details className="relative shrink-0">
                <summary className="inline-flex list-none h-8 min-w-8 cursor-pointer items-center justify-center rounded-full border border-white/15 bg-white/5 px-2 text-xs font-bold text-slate-100 transition hover:-translate-y-0.5 hover:border-emerald-200/50">
                  ?
                </summary>
                <div className="absolute right-0 z-20 mt-2 w-[22rem] max-w-[85vw] rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-2xl backdrop-blur">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Spaltensymbole</p>
                  <div className="mt-3 space-y-3 text-xs text-slate-200">
                    <div>
                      <p className="font-semibold text-white">Treffer</p>
                      <p>
                        <span aria-hidden>✅</span> Richtig, <span aria-hidden>❌</span> Falsch, <span aria-hidden>🎯</span> Trefferquote,{" "}
                        <span aria-hidden>⭐</span> Punkte
                      </p>
                    </div>
                    <div>
                      <p className="font-semibold text-white">Community</p>
                      <p>
                        <span aria-hidden>✅</span> Angenommen, <span aria-hidden>💬</span> Kommentare, <span aria-hidden>🎯</span> Auflösung,{" "}
                        <span aria-hidden>⭐</span> Punkte
                      </p>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        </section>
        <section className="mt-4 lg:hidden">
          {view === "treffer" ? (
            <TrefferLeaderboardPanel
              category={category}
              days={days}
              minSamples={minSamples}
              resolvedCount={resolvedCount}
              leaders={treffer.leaders}
              ranks={trefferRanks}
            />
          ) : (
            <CommunityLeaderboardPanel category={category} leaders={communityLeaders} ranks={communityRanks} />
          )}
        </section>

        <section className="mt-4 hidden gap-4 lg:grid lg:grid-cols-2">
          <TrefferLeaderboardPanel
            category={category}
            days={days}
            minSamples={minSamples}
            resolvedCount={resolvedCount}
            leaders={treffer.leaders}
            ranks={trefferRanks}
          />
          <CommunityLeaderboardPanel category={category} leaders={communityLeaders} ranks={communityRanks} />
        </section>
      </div>
    </main>
  );
}



