import Link from "next/link";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const dynamic = "force-dynamic";

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
};

type CategoryCount = {
  category: string;
  icon: string;
  color: string;
  count: number;
};

function formatDateTime(value: string) {
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

export default async function ArchivPage(props: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = props.searchParams ? await props.searchParams : {};
  const pageParam = sp.page;
  const page = Math.max(1, Number(Array.isArray(pageParam) ? pageParam[0] : pageParam ?? "1") || 1);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  const nowIso = new Date().toISOString();
  const supabase = getSupabaseAdminClient();

  const { count: totalQuestionsRaw, error: totalQuestionsError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("visibility", "public");
  const totalQuestions = totalQuestionsError ? 0 : totalQuestionsRaw ?? 0;

  const { count: openQuestionsRaw, error: openQuestionsError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("visibility", "public")
    .gte("closes_at", nowIso);
  const openQuestions = openQuestionsError ? 0 : openQuestionsRaw ?? 0;

  const { count: endedQuestionsRaw, error: endedQuestionsError } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("visibility", "public")
    .lt("closes_at", nowIso);
  const endedQuestions = endedQuestionsError ? 0 : endedQuestionsRaw ?? 0;

  const { count: totalVotesRaw, error: totalVotesError } = await supabase
    .from("votes")
    .select("question_id, questions!inner(visibility)", { count: "exact", head: true })
    .eq("questions.visibility", "public");
  const totalVotes = totalVotesError ? 0 : totalVotesRaw ?? 0;

  const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { count: votes30dRaw, error: votes30dError } = await supabase
    .from("votes")
    .select("question_id, questions!inner(visibility)", { count: "exact", head: true })
    .eq("questions.visibility", "public")
    .gte("created_at", since30d);
  const votes30d = votes30dError ? 0 : votes30dRaw ?? 0;

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
    .gte("closes_at", nowIso)
    .order("closes_at", { ascending: true })
    .limit(3);
  const openSoon = ((openSoonRows as any[]) ?? []) as PublicQuestionRow[];

  const { data: endedRows, count: endedTotal } = await supabase
    .from("questions")
    .select("id,title,category,category_icon,category_color,region,closes_at,yes_votes,no_votes", {
      count: "exact",
    })
    .eq("visibility", "public")
    .lt("closes_at", nowIso)
    .order("closes_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const ended = ((endedRows as any[]) ?? []) as PublicQuestionRow[];

  const prevHref = page > 1 ? `/archiv?page=${page - 1}` : null;
  const nextHref = endedTotal && offset + pageSize < endedTotal ? `/archiv?page=${page + 1}` : null;

  return (
    <main className="page-enter min-h-screen bg-transparent text-slate-50">
      <div className="mx-auto w-full max-w-4xl px-4 pb-12 pt-8 sm:px-6 sm:pt-10">
        <Link href="/" className="text-sm text-emerald-100 hover:text-emerald-200">
          ← Zurück zum Feed
        </Link>

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
            <p className="mt-1 text-xs text-slate-400">Letzte 30 Tage</p>
          </div>
        </section>

        <section className="mt-4 grid gap-3 lg:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-black/20 p-4 shadow-xl shadow-black/20 sm:p-5 lg:col-span-2">
            <h2 className="text-sm font-semibold text-white">Erfolgsquote</h2>
            <p className="mt-1 text-sm text-slate-300">
              Kommt, sobald die ersten Fragen entschieden sind. Dann zeigen wir hier transparent:{" "}
              <span className="font-semibold text-slate-100">X von Y</span> richtig, inklusive Kategorie‑Vergleich.
            </p>
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
                      className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-3 py-2 hover:border-emerald-200/30"
                    >
                      <span className="min-w-0">
                        <span className="card-title-wrap block text-sm font-semibold text-white">{q.title}</span>
                        <span className="mt-0.5 block text-[11px] text-slate-400">Endet: {formatDateTime(q.closes_at)}</span>
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
              {ended.map((q) => {
                const outcome = outcomeLabel(q.yes_votes ?? 0, q.no_votes ?? 0);
                const total = Math.max(0, (q.yes_votes ?? 0) + (q.no_votes ?? 0));
                return (
                  <article key={q.id} className="rounded-3xl border border-white/10 bg-white/5 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
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
                      <div className="flex flex-col items-end gap-2">
                        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${outcome.className}`}>
                          {outcome.label}
                        </span>
                        <Link
                          href={`/questions/${encodeURIComponent(q.id)}`}
                          className="text-xs font-semibold text-emerald-100 hover:text-emerald-200"
                        >
                          Details ansehen →
                        </Link>
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
