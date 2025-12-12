import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { ProfileRegionForm } from "./ProfileRegionForm";

export const dynamic = "force-dynamic";

export default async function ProfilPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) {
    redirect("/auth");
  }

  const user = await getUserBySessionSupabase(sessionId);
  if (!user) {
    redirect("/auth");
  }

  let createdLabel = "unbekannt";
  if (user.createdAt) {
    const date = new Date(user.createdAt);
    if (!Number.isNaN(date.getTime())) {
      createdLabel = date.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    }
  }

  // Einfache Profil-Statistiken direkt aus Supabase laden
  const supabase = getSupabaseClient();

  type ProfileStats = {
    draftsTotal: number;
    draftsAccepted: number;
    draftsRejected: number;
    votesTotal: number;
    votesYes: number;
    votesNo: number;
    topCategories: { category: string; votes: number; yes: number; no: number }[];
  };

  let stats: ProfileStats | null = null;
  try {
    const { count: draftsTotal } = await supabase
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id);

    const { count: draftsAccepted } = await supabase
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("status", "accepted");

    const { count: draftsRejected } = await supabase
      .from("drafts")
      .select("id", { count: "exact", head: true })
      .eq("creator_id", user.id)
      .eq("status", "rejected");

    const { count: votesTotal, data: voteRows } = await supabase
      .from("votes")
      .select("question_id, choice", { count: "exact" })
      .eq("user_id", user.id);

    const { count: votesYes } = await supabase
      .from("votes")
      .select("question_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("choice", "yes");

    const { count: votesNo } = await supabase
      .from("votes")
      .select("question_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("choice", "no");

    // Top-Kategorien aus den eigenen Votes berechnen
    let topCategories: { category: string; votes: number; yes: number; no: number }[] = [];
    if (voteRows && voteRows.length > 0) {
      const questionIds = Array.from(new Set((voteRows as { question_id: string }[]).map((v) => v.question_id)));

      const { data: questionRows } = await supabase
        .from("questions")
        .select("id, category")
        .in("id", questionIds);

      const categoryById = new Map<string, string>();
      (questionRows as { id: string; category: string }[] | null | undefined)?.forEach((q) => {
        categoryById.set(q.id, q.category ?? "Sonstiges");
      });

      const statsMap = new Map<string, { category: string; votes: number; yes: number; no: number }>();
      (voteRows as { question_id: string; choice: "yes" | "no" }[]).forEach((vote) => {
        const category = categoryById.get(vote.question_id) ?? "Sonstiges";
        const current = statsMap.get(category) ?? { category, votes: 0, yes: 0, no: 0 };
        current.votes += 1;
        if (vote.choice === "yes") current.yes += 1;
        if (vote.choice === "no") current.no += 1;
        statsMap.set(category, current);
      });

      topCategories = Array.from(statsMap.values())
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 3);
    }

    stats = {
      draftsTotal: draftsTotal ?? 0,
      draftsAccepted: draftsAccepted ?? 0,
      draftsRejected: draftsRejected ?? 0,
      votesTotal: votesTotal ?? 0,
      votesYes: votesYes ?? 0,
      votesNo: votesNo ?? 0,
      topCategories,
    };
  } catch {
    stats = null;
  }

  return (
    <main className="page-enter min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-16 pt-10">
        <Link href="/" className="self-start text-sm text-emerald-100 hover:text-emerald-200">
          &larr; Zurueck zum Feed
        </Link>

        <section className="mt-4 rounded-3xl border border-white/10 bg-white/10 p-6 shadow-2xl shadow-emerald-500/20 backdrop-blur">
          <h1 className="text-2xl font-bold text-white">Dein Profil</h1>
          <p className="mt-1 text-sm text-slate-300">
            Hier siehst du die wichtigsten Daten zu deinem Future-Vote-Account.
          </p>

          <div className="mt-4 space-y-3 text-sm text-slate-100">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Anzeige-Name</span>
              <span className="font-semibold text-white">{user.displayName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">E-Mail</span>
              <span className="truncate font-medium text-slate-50">{user.email}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Rolle</span>
              <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-100">
                {user.role === "admin" ? "Admin" : "User"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-300">Registriert seit</span>
              <span className="font-medium text-slate-100">{createdLabel}</span>
            </div>
          </div>

          <ProfileRegionForm initialRegion={user.defaultRegion ?? null} />

          {stats && (
            <div className="mt-5 space-y-3 rounded-2xl bg-black/30 px-3 py-3 text-xs text-slate-300">
              <p className="font-semibold text-slate-100">Deine Aktivitaet (bisher)</p>
              <div className="space-y-2">
                <Link
                  href="/profil/aktivitaet?typ=drafts_all"
                  className="group flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10"
                >
                  <span className="font-medium text-slate-100 group-hover:text-white">
                    Vorgeschlagene Fragen
                  </span>
                  <span className="rounded-full bg-black/40 px-2 py-1 text-[11px] font-semibold text-slate-50 group-hover:bg-black/60">
                    {stats.draftsTotal}
                  </span>
                </Link>
                <Link
                  href="/profil/aktivitaet?typ=drafts_accepted"
                  className="group flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10"
                >
                  <span className="font-medium text-slate-100 group-hover:text-white">Davon angenommen</span>
                  <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-100 group-hover:bg-emerald-500/30">
                    {stats.draftsAccepted}
                  </span>
                </Link>
                <Link
                  href="/profil/aktivitaet?typ=drafts_rejected"
                  className="group flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10"
                >
                  <span className="font-medium text-slate-100 group-hover:text-white">Davon abgelehnt</span>
                  <span className="rounded-full bg-rose-500/20 px-2 py-1 text-[11px] font-semibold text-rose-100 group-hover:bg-rose-500/30">
                    {stats.draftsRejected}
                  </span>
                </Link>
                <div className="mt-2 border-t border-white/10 pt-2 space-y-2">
                  <Link
                    href="/profil/aktivitaet?typ=votes_all"
                    className="group flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10"
                  >
                    <span className="font-medium text-slate-100 group-hover:text-white">
                      Abgegebene Stimmen (gesamt)
                    </span>
                    <span className="rounded-full bg-black/40 px-2 py-1 text-[11px] font-semibold text-slate-50 group-hover:bg-black/60">
                      {stats.votesTotal}
                    </span>
                  </Link>
                  <Link
                    href="/profil/aktivitaet?typ=votes_yes"
                    className="group flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10"
                  >
                    <span className="font-medium text-slate-100 group-hover:text-white">Davon Ja</span>
                    <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-100 group-hover:bg-emerald-500/30">
                      {stats.votesYes}
                    </span>
                  </Link>
                  <Link
                    href="/profil/aktivitaet?typ=votes_no"
                    className="group flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20 transition hover:-translate-y-0.5 hover:border-emerald-300/50 hover:bg-emerald-500/10"
                  >
                    <span className="font-medium text-slate-100 group-hover:text-white">Davon Nein</span>
                    <span className="rounded-full bg-rose-500/20 px-2 py-1 text-[11px] font-semibold text-rose-100 group-hover:bg-rose-500/30">
                      {stats.votesNo}
                    </span>
                  </Link>
                </div>
                {stats.topCategories.length > 0 && (
                  <div className="mt-2 border-t border-white/10 pt-2">
                    <p className="mb-1 font-semibold text-slate-100">Deine Top-Kategorien</p>
                    <div className="space-y-1.5">
                      {stats.topCategories.map((cat) => (
                        <div key={cat.category} className="flex items-center justify-between gap-3">
                          <span className="truncate">{cat.category}</span>
                          <span className="text-[11px] font-semibold text-slate-200">
                            {cat.votes} Stimmen{" "}
                            <span className="text-emerald-200">
                              (Ja {cat.yes}
                            </span>
                            <span className="text-slate-400"> · </span>
                            <span className="text-rose-200">Nein {cat.no}</span>
                            )
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">
                Hinweis: Die Zahlen basieren auf Daten, die seit Einfuehrung der Supabase-DB gesammelt werden.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
