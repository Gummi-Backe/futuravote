import Link from "next/link";
import type { Metadata } from "next";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { ResolvedSuccessCard } from "@/app/components/ResolvedSuccessCard";
import { ShareLinkButton } from "@/app/components/ShareLinkButton";
import { SmartBackButton } from "@/app/components/SmartBackButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de"),
  title: "Archiv & Statistiken – Future‑Vote",
  description:
    "Transparente Plattform-Statistiken und Archiv beendeter Umfragen – inklusive Ergebnis zum Endzeitpunkt.",
  alternates: { canonical: "/archiv" },
  openGraph: {
    title: "Archiv & Statistiken – Future‑Vote",
    description:
      "Transparente Plattform-Statistiken und Archiv beendeter Umfragen – inklusive Ergebnis zum Endzeitpunkt.",
    url: "/archiv",
    type: "website",
    images: [
      {
        url: "/archiv/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Future‑Vote Archiv & Statistiken",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Archiv & Statistiken – Future‑Vote",
    description:
      "Transparente Plattform-Statistiken und Archiv beendeter Umfragen – inklusive Ergebnis zum Endzeitpunkt.",
    images: ["/archiv/opengraph-image"],
  },
};

type PublicQuestionRow = {
  id: string;
  title: string;
  category: string;
  category_icon: string;
  category_color: string;
  region: string | null;
  closes_at: string;
  yes_votes: number;
  no_votes: number;
  resolved_outcome?: "yes" | "no" | null;
};

type CategoryCount = {
  category: string;
  icon: string;
  color: string;
  count: number;
};

function timeUntilLabel(targetIso: string, nowMs: number) {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(targetIso);
  if (isDateOnly) {
    const todayIso = new Date(nowMs).toISOString().slice(0, 10);
    const todayMs = Date.parse(todayIso);
    const targetMs = Date.parse(targetIso);
    if (!Number.isFinite(todayMs) || !Number.isFinite(targetMs)) return null;
    const diffDays = Math.round((targetMs - todayMs) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "Endet heute";
    if (diffDays === 1) return "Endet morgen";
    return `Endet in ${diffDays} Tagen`;
  }

  const targetMs = Date.parse(targetIso);
  if (!Number.isFinite(targetMs)) return null;
  const diffMs = targetMs - nowMs;
  if (diffMs <= 0) return "Endet heute";
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) return `Endet in ${diffHours}h`;
  const diffDays = Math.ceil(diffHours / 24);
  if (diffDays === 1) return "Endet morgen";
  return `Endet in ${diffDays} Tagen`;
}

function formatDateTime(value: string) {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return value;
  if (isDateOnly) {
    return new Date(ms).toLocaleDateString("de-DE", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  }
  return new Date(ms).toLocaleString("de-DE", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function outcomeLabel(yesVotes: number, noVotes: number) {
  const total = Math.max(0, yesVotes + noVotes);
  const yesPct = total > 0 ? Math.round((yesVotes / total) * 100) : 0;
  const noPct = 100 - yesPct;
  if (total === 0) return { label: "Keine Stimmen", className: "bg-white/5 text-slate-200 border-white/10" };
  if (yesVotes === noVotes) return { label: `Unentschieden (${yesPct}% / ${noPct}%)`, className: "bg-sky-500/15 text-sky-100 border-sky-300/30" };
  const yesWins = yesVotes > noVotes;
  return {
    label: yesWins ? `Mehrheit: Ja (${yesPct}%)` : `Mehrheit: Nein (${noPct}%)`,
    className: yesWins ? "bg-emerald-500/15 text-emerald-100 border-emerald-300/30" : "bg-rose-500/15 text-rose-100 border-rose-300/30",
  };
}

function pct(part: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

function getMajorityChoice(yesVotes: number, noVotes: number): "yes" | "no" | null {
  if (yesVotes === noVotes) return null;
  return yesVotes > noVotes ? "yes" : "no";
}

export default async function ArchivPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = props.searchParams ? await props.searchParams : {};
  const pageParam = sp.page;
  const page = Math.max(1, Number(Array.isArray(pageParam) ? pageParam[0] : pageParam ?? "1") || 1);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const nowIso = new Date().toISOString();
  const nowMs = Date.parse(nowIso);
  const todayIso = new Date(nowMs).toISOString().slice(0, 10);
  const supabase = getSupabaseAdminClient();
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL?.trim() || "https://www.future-vote.de";

  const { count: totalQuestionsRaw, error: totalQuestionsError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("visibility", "public");
  const totalQuestions = totalQuestionsError ? 0 : totalQuestionsRaw ?? 0;

  const { count: openQuestionsRaw, error: openQuestionsError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("visibility", "public")
    .gte("closes_at", todayIso);
  const openQuestions = openQuestionsError ? 0 : openQuestionsRaw ?? 0;

  const { count: endedQuestionsRaw, error: endedQuestionsError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("visibility", "public")
    .lt("closes_at", todayIso);
  const endedQuestions = endedQuestionsError ? 0 : endedQuestionsRaw ?? 0;

  const { count: totalVotesRaw, error: totalVotesError } = await supabase
    .from("votes")
    .select("question_id, questions!inner(visibility)", { count: "exact", head: true })
    .eq("questions.visibility", "public");
  const totalVotes = totalVotesError ? 0 : totalVotesRaw ?? 0;

  const since30d = new Date(nowMs - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: votes30dRaw, error: votes30dError } = await supabase
    .from("votes")
    .select("question_id, questions!inner(visibility)", { count: "exact", head: true })
    .eq("questions.visibility", "public")
    .gte("created_at", since30d);
  const votes30d = votes30dError ? 0 : votes30dRaw ?? 0;

  const since7d = new Date(nowMs - 7 * 24 * 60 * 60 * 1000).toISOString();
  const since14d = new Date(nowMs - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { count: votes7dRaw, error: votes7dError } = await supabase
    .from("votes")
    .select("question_id, questions!inner(visibility)", { count: "exact", head: true })
    .eq("questions.visibility", "public")
    .gte("created_at", since7d);
  const votes7d = votes7dError ? 0 : votes7dRaw ?? 0;

  const { count: votesPrev7dRaw, error: votesPrev7dError } = await supabase
    .from("votes")
    .select("question_id, questions!inner(visibility)", { count: "exact", head: true })
    .eq("questions.visibility", "public")
    .gte("created_at", since14d)
    .lt("created_at", since7d);
  const votesPrev7d = votesPrev7dError ? 0 : votesPrev7dRaw ?? 0;
  const votes7dDelta = votes7d - votesPrev7d;
  const votes7dPct =
    votesPrev7d > 0 ? Math.round(((votes7d - votesPrev7d) / votesPrev7d) * 100) : votes7d > 0 ? 100 : 0;

  const { data: categoryRows } = await supabase
    .from("questions")
    .select("category,category_icon,category_color")
    .eq("visibility", "public");

  const categories: CategoryCount[] = (() => {
    const map = new Map<string, CategoryCount>();
    for (const row of (categoryRows as any[]) ?? []) {
      const cat = String(row?.category ?? "").trim();
      if (!cat) continue;
      const entry = map.get(cat) ?? {
        category: cat,
        icon: String(row?.category_icon ?? "🏛️"),
        color: String(row?.category_color ?? "#10b981"),
        count: 0,
      };
      entry.count += 1;
      map.set(cat, entry);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  })();

  const avgVotesPerQuestion = totalQuestions > 0 ? Math.round((totalVotes / totalQuestions) * 10) / 10 : 0;

  const { data: openSoonRows } = await supabase
    .from("questions")
    .select("id,title,category,category_icon,category_color,region,closes_at,yes_votes,no_votes")
    .eq("visibility", "public")
    .gte("closes_at", todayIso)
    .order("closes_at", { ascending: true })
    .limit(3);
  const openSoon = ((openSoonRows as any[]) ?? []) as PublicQuestionRow[];
  const firstEndsLabel = openSoon.length > 0 ? timeUntilLabel(openSoon[0].closes_at, nowMs) : null;

  const { data: endedRows, count: endedTotal } = await supabase
    .from("questions")
    .select("id,title,category,category_icon,category_color,region,closes_at,yes_votes,no_votes,resolved_outcome", {
      count: "exact",
    })
    .eq("visibility", "public")
    .lt("closes_at", todayIso)
    .order("closes_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const ended = ((endedRows as any[]) ?? []) as PublicQuestionRow[];

  const { data: resolvedRows } = await supabase
    .from("questions")
    .select("yes_votes,no_votes,resolved_outcome")
    .eq("visibility", "public")
    .lt("closes_at", todayIso)
    .not("resolved_outcome", "is", null);

  const resolved = ((resolvedRows as any[]) ?? []) as Pick<PublicQuestionRow, "yes_votes" | "no_votes" | "resolved_outcome">[];
  const resolvedConsidered = resolved.filter((r) => r.resolved_outcome && getMajorityChoice(r.yes_votes ?? 0, r.no_votes ?? 0));
  const resolvedTotalConsidered = resolvedConsidered.length;
  const resolvedCorrect = resolvedConsidered.reduce((acc, r) => {
    const majority = getMajorityChoice(r.yes_votes ?? 0, r.no_votes ?? 0);
    if (!majority || !r.resolved_outcome) return acc;
    return acc + (majority === r.resolved_outcome ? 1 : 0);
  }, 0);
  const resolvedAccuracyPct =
    resolvedTotalConsidered > 0 ? Math.round((resolvedCorrect / resolvedTotalConsidered) * 100) : null;

  const prevHref = page > 1 ? `/archiv?page=${page - 1}` : null;
  const nextHref = endedTotal && offset + pageSize < endedTotal ? `/archiv?page=${page + 1}` : null;

  return (
    <main className="page-enter min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
        <SmartBackButton
          fallbackHref="/"
          label="← Zurück"
          className="text-sm text-emerald-100 hover:text-emerald-200 bg-transparent p-0"
        />

        <header className="mt-4 rounded-3xl border border-white/10 bg-white/10 px-4 py-5 shadow-2xl shadow-emerald-500/10 backdrop-blur sm:px-6">
          <h1 className="text-2xl font-semibold text-white">Archiv & Statistiken</h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-200">
            Wie entwickelt sich Future‑Vote? Hier siehst du transparent, wie aktiv die Plattform ist und welche Themen die Community
            beschäftigen. Beendete Umfragen findest du im Archiv – inklusive Ergebnis{" "}
            <span className="font-semibold text-white">zum Endzeitpunkt</span>.
          </p>
        </header>

        <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Öffentliche Fragen</p>
            <p className="mt-1 text-2xl font-bold text-white">{totalQuestions}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Aktiv</p>
            <p className="mt-1 text-2xl font-bold text-white">{openQuestions}</p>
            <p className="mt-1 text-xs text-slate-400">Beendet: {endedQuestions}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Stimmen gesamt</p>
            <p className="mt-1 text-2xl font-bold text-white">{totalVotes}</p>
            <p className="mt-1 text-xs text-slate-400">Ø {avgVotesPerQuestion} pro Frage</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/20">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Stimmen (30T)</p>
            <p className="mt-1 text-2xl font-bold text-white">{votes30d}</p>
            <p className="mt-1 text-xs text-slate-400">
              Letzte 7 Tage:{" "}
              <span className="font-semibold text-slate-200">{votes7d}</span>{" "}
              <span className={`${votes7dDelta >= 0 ? "text-emerald-200" : "text-rose-200"} font-semibold`}>
                {votes7dDelta >= 0 ? `+${votes7dDelta}` : String(votes7dDelta)}
              </span>
              <span className="text-slate-400"> ({votes7dPct}% vs. Woche davor)</span>
            </p>
          </div>
        </section>

        <section className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-xl shadow-black/20 sm:p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Erfolgsquote</h2>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                {resolvedTotalConsidered > 0 && resolvedAccuracyPct !== null ? (
                  <p className="text-sm text-slate-300">
                    Community lag richtig bei{" "}
                    <span className="font-semibold text-slate-100">
                      {resolvedCorrect} von {resolvedTotalConsidered}
                    </span>{" "}
                    aufgelösten Fragen{" "}
                    <span className="font-semibold text-slate-100">({resolvedAccuracyPct}%)</span>.
                  </p>
                ) : (
                  <p className="text-sm text-slate-300">
                    <span className="font-semibold text-slate-100">Noch keine aufgelösten Fragen:</span> Sobald du Ergebnisse (Ja/Nein) pro
                    Frage einträgst, zeigen wir hier transparent <span className="font-semibold text-slate-100">X von Y</span> richtig.
                  </p>
                )}
                {firstEndsLabel ? (
                  <p className="text-xs text-slate-400">
                    Erste Frage endet: <span className="font-semibold text-slate-200">{firstEndsLabel}</span>
                  </p>
                ) : null}
              </div>
              {resolvedTotalConsidered > 0 && resolvedAccuracyPct !== null ? (
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-50">
                  <span aria-hidden="true">✅</span>
                  <span>Aktuell: {resolvedAccuracyPct}%</span>
                </div>
              ) : (
                <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-slate-200">
                  <span aria-hidden="true">⏳</span>
                  <span>Ergebnis folgt</span>
                </div>
              )}
            </div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-xl shadow-black/20 sm:p-5">
            <h2 className="text-sm font-semibold text-white">Aktivste Kategorien</h2>
            {categories.length === 0 ? (
              <p className="mt-2 text-sm text-slate-300">Noch keine Kategorien‑Daten.</p>
            ) : (
              <div className="mt-2 space-y-2">
                {categories.slice(0, 3).map((c) => (
                  <div key={c.category} className="flex items-center justify-between gap-3 text-sm">
                    <span
                      className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold"
                      style={{ backgroundColor: `${c.color}22`, color: c.color }}
                    >
                      <span aria-hidden="true">{c.icon}</span>
                      <span className="text-slate-50/90">{c.category}</span>
                    </span>
                    <span className="text-xs font-semibold text-slate-200">{c.count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-4 shadow-xl shadow-black/20 sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">Archiv (beendete Umfragen)</h2>
              <p className="mt-1 text-sm text-slate-300">
                Seite {page} ·{" "}
                {typeof endedTotal === "number" ? (
                  <span>{endedTotal} Einträge</span>
                ) : (
                  <span>aktuelle Einträge</span>
                )}
              </p>
            </div>
          </div>

          {ended.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-200">
              <p className="font-semibold text-white">Noch keine Fragen beendet</p>
              <p className="mt-1 text-sm text-slate-300">
                Die ersten Prognosen laufen gerade. Stimme mit ab – sobald die ersten Fragen enden, siehst du hier Ergebnisse und Historie.
              </p>
              {openSoon.length > 0 ? (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Als Nächstes beendet</p>
                  {openSoon.map((q) => (
                    <Link
                      key={q.id}
                      href={`/questions/${encodeURIComponent(q.id)}`}
                      className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 hover:border-emerald-200/30"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="card-title-wrap block text-sm font-semibold text-white">{q.title}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">
                          {timeUntilLabel(q.closes_at, nowMs) ?? "Endet"} · {formatDateTime(q.closes_at)}
                        </span>
                      </span>
                      <span
                        className="ml-auto inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold"
                        style={{ backgroundColor: `${q.category_color}22`, color: q.category_color }}
                      >
                        <span aria-hidden="true">{q.category_icon}</span>
                        <span className="text-slate-50/90">{q.category}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              ) : null}
              <div className="mt-4">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-50 hover:border-emerald-200/60"
                >
                  Zu den aktiven Fragen →
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {(() => {
                const resolved = ended.filter((q) => q.resolved_outcome === "yes" || q.resolved_outcome === "no");
                if (resolved.length === 0) return null;
                const best = resolved.reduce((acc, cur) => {
                  const accTotal = Math.max(0, (acc.yes_votes ?? 0) + (acc.no_votes ?? 0));
                  const curTotal = Math.max(0, (cur.yes_votes ?? 0) + (cur.no_votes ?? 0));
                  return curTotal > accTotal ? cur : acc;
                }, resolved[0]);

                return (
                  <ResolvedSuccessCard
                    title={best.title}
                    url={`${baseUrl}/questions/${encodeURIComponent(best.id)}`}
                    resolvedOutcome={best.resolved_outcome as "yes" | "no"}
                    yesVotes={best.yes_votes ?? 0}
                    noVotes={best.no_votes ?? 0}
                  />
                );
              })()}

              {ended.map((q) => {
                const outcome = outcomeLabel(q.yes_votes ?? 0, q.no_votes ?? 0);
                const total = Math.max(0, (q.yes_votes ?? 0) + (q.no_votes ?? 0));
                const shareTextParts = [
                  `Ergebnis: ${q.resolved_outcome === "yes" ? "Ja" : q.resolved_outcome === "no" ? "Nein" : "ausstehend"}.`,
                  `Community: ${pct(q.yes_votes ?? 0, total)}% Ja · ${pct(q.no_votes ?? 0, total)}% Nein (${total} Stimmen).`,
                ];
                const shareText = `${q.title}\n${shareTextParts.join(" ")}`;
                return (
                  <article key={q.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className="inline-flex items-center gap-2 rounded-full px-3 py-1 font-semibold"
                            style={{ backgroundColor: `${q.category_color}22`, color: q.category_color }}
                          >
                            <span aria-hidden="true">{q.category_icon}</span>
                            <span className="text-slate-50/90">{q.category}</span>
                          </span>
                          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                            Ende: {formatDateTime(q.closes_at)}
                          </span>
                          {q.region ? (
                            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-slate-200">
                              Region: {q.region}
                            </span>
                          ) : null}
                        </div>
                        <h3 className="mt-2 card-title-wrap text-base font-semibold text-white">{q.title}</h3>
                        <p className="mt-1 text-xs text-slate-300">
                          Stimmen: {total} · Ja {q.yes_votes ?? 0} · Nein {q.no_votes ?? 0}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center justify-between gap-2 sm:flex-col sm:items-end sm:justify-start">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${outcome.className}`}>
                          {outcome.label}
                        </span>
                        <div className="flex items-center gap-2">
                          {q.resolved_outcome === "yes" || q.resolved_outcome === "no" ? (
                            <ShareLinkButton
                              url={`${baseUrl}/questions/${encodeURIComponent(q.id)}`}
                              variant="icon"
                              label="Ergebnis teilen"
                              shareTitle="Future‑Vote Ergebnis"
                              shareText={shareText}
                            />
                          ) : null}
                          <Link
                            href={`/questions/${encodeURIComponent(q.id)}`}
                            className="whitespace-nowrap text-xs font-semibold text-emerald-100 hover:text-emerald-200"
                          >
                            Details ansehen →
                          </Link>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            {prevHref ? (
              <Link href={prevHref} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:border-emerald-200/40">
                ← Zurück
              </Link>
            ) : (
              <span />
            )}
            {nextHref ? (
              <Link href={nextHref} className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white hover:border-emerald-200/40">
                Weiter →
              </Link>
            ) : (
              <span />
            )}
          </div>
        </section>

        <p className="mt-4 text-xs text-slate-400">
          Hinweis: Private Umfragen erscheinen hier nicht.
        </p>
      </div>
    </main>
  );
}
