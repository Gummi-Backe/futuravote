import Link from "next/link";
import type { Metadata } from "next";
import { categories } from "@/app/data/mock";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 30;

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de"),
  title: "Rangliste - Future-Vote",
  description: "Wer liegt oft richtig? Rangliste nach Trefferquote und Anzahl entschiedener Fragen.",
  alternates: { canonical: "/rangliste" },
};

type ResolvedQuestionRow = {
  id: string;
  resolved_outcome: "yes" | "no" | null;
};

type VoteRow = {
  user_id: string | null;
  question_id: string;
  choice: "yes" | "no";
};

type UserRow = {
  id: string;
  display_name: string;
};

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function pointsTier(pointsTotal: number): "none" | "bronze" | "silver" | "gold" {
  if (pointsTotal >= 200) return "gold";
  if (pointsTotal >= 50) return "silver";
  if (pointsTotal >= 10) return "bronze";
  return "none";
}

export default async function RanglistePage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const days = clampInt(sp.days, 90, 7, 365);
  const category = (sp.category ?? "all").trim() || "all";
  const minSamples = 5;
  const limit = 25;

  const supabase = getSupabaseAdminClient();
  const startIso = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  let resolvedQuery = supabase
    .from("questions")
    .select("id,resolved_outcome", { count: "exact" })
    .eq("visibility", "public")
    .not("resolved_outcome", "is", null)
    .gte("resolved_at", startIso)
    .limit(5000);

  if (category !== "all") {
    resolvedQuery = resolvedQuery.eq("category", category);
  }

  const { data: resolvedRows, error: resolvedError } = await resolvedQuery;
  if (resolvedError) {
    throw new Error(`Rangliste: resolved questions query fehlgeschlagen: ${resolvedError.message}`);
  }

  const resolved = (resolvedRows ?? []) as ResolvedQuestionRow[];
  const outcomeByQuestionId = new Map<string, "yes" | "no">();
  resolved.forEach((q) => {
    if (!q?.id || !q.resolved_outcome) return;
    outcomeByQuestionId.set(q.id, q.resolved_outcome);
  });

  const questionIds = Array.from(outcomeByQuestionId.keys());

  const userById = new Map<string, string>();
  const leaderboard: Array<{
    userId: string;
    displayName: string;
    total: number;
    correct: number;
    incorrect: number;
    accuracyPct: number;
    pointsTotal: number;
    tier: "none" | "bronze" | "silver" | "gold";
  }> = [];

  if (questionIds.length > 0) {
    const statsByUser = new Map<string, { total: number; correct: number; incorrect: number }>();

    const chunkSize = 200;
    for (let i = 0; i < questionIds.length; i += chunkSize) {
      const chunk = questionIds.slice(i, i + chunkSize);
      const { data: voteRows, error: voteError } = await supabase
        .from("votes")
        .select("user_id,question_id,choice")
        .in("question_id", chunk)
        .not("user_id", "is", null)
        .limit(20000);

      if (voteError) {
        throw new Error(`Rangliste: votes query fehlgeschlagen: ${voteError.message}`);
      }

      (voteRows ?? []).forEach((v) => {
        const row = v as VoteRow;
        if (!row.user_id || !row.question_id || !row.choice) return;
        const outcome = outcomeByQuestionId.get(row.question_id);
        if (!outcome) return;
        const cur = statsByUser.get(row.user_id) ?? { total: 0, correct: 0, incorrect: 0 };
        cur.total += 1;
        const ok = row.choice === outcome;
        if (ok) cur.correct += 1;
        else cur.incorrect += 1;
        statsByUser.set(row.user_id, cur);
      });
    }

    const userIds = Array.from(statsByUser.keys());
    for (let i = 0; i < userIds.length; i += 200) {
      const chunk = userIds.slice(i, i + 200);
      const { data: userRows, error: userError } = await supabase.from("users").select("id,display_name").in("id", chunk);
      if (userError) {
        throw new Error(`Rangliste: users query fehlgeschlagen: ${userError.message}`);
      }
      ((userRows ?? []) as UserRow[]).forEach((u) => userById.set(u.id, u.display_name));
    }

    statsByUser.forEach((s, userId) => {
      if (s.total < minSamples) return;
      const accuracyPct = Math.round((s.correct / s.total) * 100);
      const pointsTotal = Math.max(0, s.correct) * 10;
      leaderboard.push({
        userId,
        displayName: userById.get(userId) ?? "Anonym",
        total: s.total,
        correct: s.correct,
        incorrect: s.incorrect,
        accuracyPct,
        pointsTotal,
        tier: pointsTier(pointsTotal),
      });
    });

    leaderboard.sort((a, b) => {
      if (b.correct !== a.correct) return b.correct - a.correct;
      if (b.accuracyPct !== a.accuracyPct) return b.accuracyPct - a.accuracyPct;
      if (b.total !== a.total) return b.total - a.total;
      return a.displayName.localeCompare(b.displayName, "de");
    });
  }

  const shown = leaderboard.slice(0, limit);

  const makeHref = (next: { days?: number; category?: string }) => {
    const nextDays = next.days ?? days;
    const nextCategory = next.category ?? category;
    const params = new URLSearchParams();
    if (nextDays !== 90) params.set("days", String(nextDays));
    if (nextCategory && nextCategory !== "all") params.set("category", nextCategory);
    const qs = params.toString();
    return qs ? `/rangliste?${qs}` : "/rangliste";
  };

  return (
    <main className="min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto max-w-6xl px-4 pb-12 pt-6 lg:px-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Link href="/" className="inline-flex items-center gap-2 text-sm text-slate-300 hover:text-white">
              <span aria-hidden="true">←</span> Zurück
            </Link>
            <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">Rangliste</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-200">
              Hier zählen nur <span className="font-semibold text-white">entschiedene</span> (aufgelöste) öffentliche Fragen.
              <span className="text-slate-400"> · </span>
              Mindestens {minSamples} entschiedene Fragen im Zeitraum, damit du gelistet wirst.
            </p>
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

            <div className="rounded-2xl border border-white/10 bg-black/25 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm font-semibold text-white">
                  Top {shown.length} {category === "all" ? "gesamt" : category}
                </p>
                <p className="text-xs text-slate-300">
                  Zeitraum: letzte {days} Tage <span className="text-slate-500">·</span> Sortiert nach richtigen Tipps
                </p>
              </div>

              {questionIds.length === 0 ? (
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
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

