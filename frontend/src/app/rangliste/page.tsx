import Link from "next/link";
import type { Metadata } from "next";
import { categories } from "@/app/data/mock";
import { SmartBackButton } from "@/app/components/SmartBackButton";
import {
  type LeaderboardView,
  getCommunityLeaderboard,
  getTrefferLeaderboard,
} from "@/app/data/leaderboards";

export const revalidate = 30;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de"),
  title: "Rangliste - Future-Vote",
  description: "Rangliste für Treffer (richtige Prognosen) und Community-Beiträge auf Future‑Vote.",
  alternates: { canonical: "/rangliste" },
};

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export default async function RanglistePage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; days?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const view: LeaderboardView = sp.view === "community" ? "community" : "treffer";
  const days = clampInt(sp.days, 90, 7, 365);
  const category = (sp.category ?? "all").trim() || "all";
  const minSamples = 5;
  const limit = 25;

  const treffer = view === "treffer"
    ? await getTrefferLeaderboard({ days, category, minSamples, limit })
    : { resolvedCount: 0, leaders: [] };
  const communityLeaders = view === "community" ? await getCommunityLeaderboard({ category, limit }) : [];

  const shown = treffer.leaders;

  const makeHref = (next: { view?: LeaderboardView; days?: number; category?: string }) => {
    const nextView = next.view ?? view;
    const nextDays = next.days ?? days;
    const nextCategory = next.category ?? category;
    const params = new URLSearchParams();
    if (nextView !== "treffer") params.set("view", nextView);
    if (nextView === "treffer" && nextDays !== 90) params.set("days", String(nextDays));
    if (nextCategory && nextCategory !== "all") params.set("category", nextCategory);
    const qs = params.toString();
    return qs ? `/rangliste?${qs}` : "/rangliste";
  };

  return (
    <main className="min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 lg:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <SmartBackButton
              fallbackHref="/"
              label="← Zurück"
            />
            <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Rangliste</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              {view === "treffer" ? (
                <>
                  Hier zählen nur <span className="font-semibold text-white">entschiedene</span> (aufgelöste) öffentliche Fragen.
                  <span className="text-slate-400"> · </span>
                  Mindestens {minSamples} entschiedene Fragen im Zeitraum, damit du gelistet wirst.
                </>
              ) : (
                <>
                  Hier zählen <span className="font-semibold text-white">Beiträge</span> zur Community: angenommene Vorschläge,
                  Kommentare und Auflösungs‑Vorschläge (bei Prognosen).
                </>
              )}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={makeHref({ view: "treffer" })}
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
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Kategorie</span>
              <div className="flex flex-wrap gap-2">
                <Link
                  href={makeHref({ category: "all" })}
                  className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition ${
                    category === "all"
                      ? "border-emerald-300/60 bg-emerald-500/20 text-white hover:-translate-y-0.5"
                      : "border-white/10 bg-white/5 text-slate-100 hover:-translate-y-0.5 hover:border-emerald-200/40"
                  }`}
                >
                  Alle
                </Link>
                {categories.map((cat) => {
                  const isActive = category === cat.label;
                  return (
                    <Link
                      key={cat.label}
                      href={makeHref({ category: cat.label })}
                      className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition ${
                        isActive
                          ? "border-emerald-300/60 bg-emerald-500/25 text-white hover:-translate-y-0.5"
                          : "border-white/10 bg-white/5 text-slate-100 hover:-translate-y-0.5 hover:border-emerald-200/40"
                      }`}
                    >
                      <span aria-hidden="true">{cat.icon}</span>
                      <span>{cat.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {view === "treffer" ? (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-300">Zeitraum</span>
                <div className="flex flex-wrap gap-2">
                  {[30, 90].map((d) => {
                    const isActive = days === d;
                    return (
                      <Link
                        key={d}
                        href={makeHref({ days: d })}
                        className={`inline-flex min-w-fit shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold shadow-sm shadow-black/20 transition ${
                          isActive
                            ? "border-emerald-300/60 bg-emerald-500/20 text-white hover:-translate-y-0.5"
                            : "border-white/10 bg-white/5 text-slate-100 hover:-translate-y-0.5 hover:border-emerald-200/40"
                        }`}
                      >
                        {d}T
                      </Link>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  Top {view === "treffer" ? shown.length : communityLeaders.length} {category === "all" ? "gesamt" : category}
                </p>
                {view === "treffer" ? (
                  <p className="text-xs text-slate-300">
                    Zeitraum: letzte {days} Tage <span className="text-slate-500">·</span> Sortiert nach richtigen Tipps
                  </p>
                ) : (
                  <p className="text-xs text-slate-300">
                    Sortiert nach Community‑Punkten <span className="text-slate-500">·</span> Nur eingeloggte Nutzer
                  </p>
                )}
              </div>

              {view === "treffer" ? (
                treffer.resolvedCount === 0 ? (
                  <p className="mt-4 text-sm text-slate-300">
                    Noch keine aufgelösten Fragen im gewählten Zeitraum. Sobald erste Fragen entschieden sind, erscheint hier die Rangliste.
                  </p>
                ) : shown.length === 0 ? (
                  <p className="mt-4 text-sm text-slate-300">
                    Noch keine Nutzer mit mindestens {minSamples} entschiedenen Fragen im gewählten Zeitraum.
                  </p>
                ) : (
                  <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-300">
                        <tr>
                          <th className="px-4 py-3">#</th>
                          <th className="px-4 py-3">Nutzer</th>
                          <th className="px-4 py-3 text-right">Richtig</th>
                          <th className="px-4 py-3 text-right">Falsch</th>
                          <th className="px-4 py-3 text-right">Trefferquote</th>
                          <th className="px-4 py-3 text-right">Punkte</th>
                        </tr>
                      </thead>
                      <tbody>
                        {shown.map((row, idx) => (
                          <tr key={row.userId} className="border-t border-white/10">
                            <td className="px-4 py-3 font-semibold text-slate-200">{idx + 1}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="text-white">{row.displayName}</span>
                                {row.tier !== "none" && (
                                  <span
                                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                      row.tier === "gold"
                                        ? "bg-amber-500/20 text-amber-200"
                                        : row.tier === "silver"
                                          ? "bg-slate-400/20 text-slate-200"
                                          : "bg-orange-500/20 text-orange-200"
                                    }`}
                                  >
                                    {row.tier === "gold" ? "Gold" : row.tier === "silver" ? "Silber" : "Bronze"}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-emerald-200">{row.correct}</td>
                            <td className="px-4 py-3 text-right font-semibold text-rose-200">{row.incorrect}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-100">
                              {row.accuracyPct}% <span className="text-xs font-normal text-slate-400">({row.total})</span>
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-100">{row.pointsTotal}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : communityLeaders.length === 0 ? (
                <p className="mt-4 text-sm text-slate-300">
                  Noch keine Community‑Beiträge im gewählten Filter. Sobald Nutzer Kommentare schreiben oder Vorschläge angenommen werden, erscheint hier die Rangliste.
                </p>
              ) : (
                <div className="mt-4 overflow-hidden rounded-2xl border border-white/10">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-xs uppercase tracking-wide text-slate-300">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Nutzer</th>
                        <th className="px-4 py-3 text-right">Angenommen</th>
                        <th className="px-4 py-3 text-right">Kommentare</th>
                        <th className="px-4 py-3 text-right">Auflösung</th>
                        <th className="px-4 py-3 text-right">Punkte</th>
                      </tr>
                    </thead>
                    <tbody>
                      {communityLeaders.map((row, idx) => (
                        <tr key={row.userId} className="border-t border-white/10">
                          <td className="px-4 py-3 font-semibold text-slate-200">{idx + 1}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span className="text-white">{row.displayName}</span>
                              {row.tier !== "none" && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                                    row.tier === "gold"
                                      ? "bg-amber-500/20 text-amber-200"
                                      : row.tier === "silver"
                                        ? "bg-slate-400/20 text-slate-200"
                                        : "bg-orange-500/20 text-orange-200"
                                  }`}
                                >
                                  {row.tier === "gold" ? "Gold" : row.tier === "silver" ? "Silber" : "Bronze"}
                                </span>
                              )}
                              {row.emailVerifiedBonus ? (
                                <span className="rounded-full border border-emerald-300/30 bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-100">
                                  Verifiziert
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-100">{row.acceptedDrafts}</td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-100">
                            {row.comments}
                            {row.commentsWithSource > 0 ? (
                              <span className="ml-1 text-xs font-normal text-slate-400">({row.commentsWithSource} mit Quelle)</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-100">
                            {row.resolutionProposals}
                            {row.appliedCommunitySuggestions > 0 ? (
                              <span className="ml-1 text-xs font-normal text-slate-400">(+{row.appliedCommunitySuggestions} übernommen)</span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-100">{row.pointsTotal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
