import Link from "next/link";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import type { PollVisibility } from "@/app/data/mock";
import { ProfileRegionForm } from "./ProfileRegionForm";
import { ShareLinkButton } from "@/app/components/ShareLinkButton";

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

export const dynamic = "force-dynamic";

export default async function ProfilPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
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
  const supabase = getSupabaseAdminClient();

  type ProfileStats = {
    draftsTotal: number;
    draftsAccepted: number;
    draftsRejected: number;
    votesTotal: number;
    votesYes: number;
    votesNo: number;
    reviewsTotal: number;
    trustScorePct: number | null;
    trustScoreSample: number;
    topCategories: { category: string; votes: number; yes: number; no: number }[];
  };

  let stats: ProfileStats | null = null;
  try {
    const reviewSessionId = cookieStore.get("fv_session")?.value ?? null;

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

    const { count: reviewsTotal } = reviewSessionId
      ? await supabase
          .from("draft_reviews")
          .select("id", { count: "exact", head: true })
          .eq("session_id", reviewSessionId)
      : { count: 0 };

    const accepted = draftsAccepted ?? 0;
    const rejected = draftsRejected ?? 0;
    const trustScoreSample = accepted + rejected;
    const trustScorePct = trustScoreSample >= 3 ? Math.round((accepted / trustScoreSample) * 100) : null;

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
      reviewsTotal: reviewsTotal ?? 0,
      trustScorePct,
      trustScoreSample,
      topCategories,
    };
  } catch {
    stats = null;
  }

  const baseUrl = await getBaseUrl();

  type PrivateQuestionRow = {
    id: string;
    title: string;
    share_id: string | null;
    created_at: string | null;
    closes_at: string | null;
    status: string | null;
  };

  type PrivateDraftRow = {
    id: string;
    title: string;
    status: string | null;
    share_id: string | null;
    created_at: string | null;
    visibility: PollVisibility | null;
  };

  let privateQuestions: { id: string; title: string; shareId: string; createdAt: string | null; status: string }[] = [];
  let privateDrafts: { id: string; title: string; status: string; shareId: string; createdAt: string | null }[] = [];
  let myDrafts: { id: string; title: string; status: string; createdAt: string | null }[] = [];
  try {
    const { data: qData, error: qError } = await supabase
      .from("questions")
      .select("id,title,share_id,created_at,closes_at,status")
      .eq("creator_id", user.id)
      .eq("visibility", "link_only")
      .not("share_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!qError && qData) {
      privateQuestions = (qData as PrivateQuestionRow[])
        .filter((q) => Boolean(q.share_id))
        .map((q) => ({
          id: q.id,
          title: q.title,
          shareId: q.share_id as string,
          createdAt: q.created_at ?? null,
          status: q.status ?? "new",
        }));
    }

    const { data, error } = await supabase
      .from("drafts")
      .select("id,title,status,share_id,created_at,visibility")
      .eq("creator_id", user.id)
      .not("share_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error && data) {
      privateDrafts = (data as PrivateDraftRow[])
        .filter((d) => (d.visibility ?? "public") === "link_only")
        .filter((d) => Boolean(d.share_id))
        .map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status ?? "open",
          shareId: d.share_id as string,
          createdAt: d.created_at ?? null,
        }));
    }

    const { data: myDraftRows, error: myDraftError } = await supabase
      .from("drafts")
      .select("id,title,status,created_at,visibility")
      .eq("creator_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!myDraftError && myDraftRows) {
      myDrafts = (myDraftRows as PrivateDraftRow[])
        .filter((d) => (d.visibility ?? "public") !== "link_only")
        .map((d) => ({
          id: d.id,
          title: d.title,
          status: d.status ?? "open",
          createdAt: d.created_at ?? null,
        }))
        .slice(0, 10);
    }
  } catch {
    privateDrafts = [];
    privateQuestions = [];
    myDrafts = [];
  }

  const tabRaw = searchParams?.tab;
  const tabValue = Array.isArray(tabRaw) ? tabRaw[0] : tabRaw;
  const activeTab = tabValue === "private" ? "private" : "drafts";

  return (
    <main className="page-enter min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex max-w-md flex-col gap-6 px-4 pb-16 pt-10">
        <Link href="/" className="self-start text-sm text-emerald-100 hover:text-emerald-200">
          &larr; Zurück zum Feed
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
              <p className="font-semibold text-slate-100">Deine Aktivität (bisher)</p>
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

                <div className="mt-2 border-t border-white/10 pt-2 space-y-2">
                  <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20">
                    <span className="font-medium text-slate-100">Draft-Reviews (dieses Gerät)</span>
                    <span className="rounded-full bg-black/40 px-2 py-1 text-[11px] font-semibold text-slate-50">
                      {stats.reviewsTotal}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-200 shadow-sm shadow-black/20">
                    <span className="font-medium text-slate-100">Vertrauens-Score</span>
                    <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-100">
                      {stats.trustScorePct === null ? "—" : `${stats.trustScorePct}%`}
                    </span>
                  </div>
                  <p className="px-3 text-[11px] text-slate-400">
                    Der Vertrauens-Score basiert aktuell nur auf angenommen/abgelehnt bei deinen Vorschlägen (mind. 3
                    Entscheidungen nötig). Reviews zählen nur für dieses Gerät.
                  </p>
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
                Hinweis: Die Zahlen basieren auf Daten, die seit Einführung der Supabase-DB gesammelt werden.
              </p>
             </div>
           )}

           <div className="mt-5 space-y-3 rounded-2xl bg-black/30 px-3 py-3 text-xs text-slate-300">
             <div className="flex items-center justify-between gap-2">
               <p className="font-semibold text-slate-100">Deine Umfragen</p>
               <div className="flex items-center gap-2">
                 <Link
                   href="/profil?tab=drafts"
                   className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition hover:-translate-y-0.5 ${
                     activeTab === "drafts"
                       ? "border-emerald-200/40 bg-emerald-500/15 text-emerald-50 shadow-lg shadow-emerald-500/20"
                       : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/30"
                   }`}
                 >
                   Meine Drafts
                 </Link>
                 <Link
                   href="/profil?tab=private"
                   className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition hover:-translate-y-0.5 ${
                     activeTab === "private"
                       ? "border-emerald-200/40 bg-emerald-500/15 text-emerald-50 shadow-lg shadow-emerald-500/20"
                       : "border-white/10 bg-white/5 text-slate-100 hover:border-emerald-200/30"
                   }`}
                 >
                   Privat (Link)
                 </Link>
               </div>
             </div>

             {activeTab === "drafts" ? (
               <>
                 <p className="text-[11px] text-slate-400">
                   Deine eingereichten Drafts sind im Review-Bereich. Sobald sie angenommen werden, landen sie in der Abstimmung.
                 </p>
                 {myDrafts.length === 0 ? (
                   <p className="text-[11px] text-slate-400">Noch keine Drafts erstellt.</p>
                 ) : (
                   <div className="space-y-2">
                     {myDrafts.map((d) => {
                       const created =
                         d.createdAt && !Number.isNaN(Date.parse(d.createdAt))
                           ? new Date(d.createdAt).toLocaleDateString("de-DE", {
                               day: "2-digit",
                               month: "2-digit",
                               year: "numeric",
                             })
                           : null;
                       const statusLabel =
                         d.status === "accepted" ? "Angenommen" : d.status === "rejected" ? "Abgelehnt" : "Offen";
                       const statusClass =
                         d.status === "accepted"
                           ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/40"
                           : d.status === "rejected"
                             ? "bg-rose-500/15 text-rose-100 border border-rose-400/40"
                             : "bg-sky-500/15 text-sky-100 border border-sky-400/30";

                       return (
                         <div
                           key={d.id}
                           className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-sm shadow-black/20"
                         >
                           <div className="min-w-0">
                             <span className="block truncate text-slate-100">{d.title}</span>
                             <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                               <span className={`rounded-full border px-2 py-0.5 font-semibold ${statusClass}`}>
                                 {statusLabel}
                               </span>
                               {created ? <span>{created}</span> : null}
                             </div>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}
               </>
             ) : (
               <>
                 <p className="text-[11px] text-slate-400">
                   Diese Umfragen erscheinen nicht im Feed. Du kannst den Link kopieren und teilen.
                 </p>
                 {privateQuestions.length === 0 && privateDrafts.length === 0 ? (
                   <p className="text-[11px] text-slate-400">Noch keine privaten Umfragen erstellt.</p>
                 ) : (
                   <div className="space-y-2">
                     {privateQuestions.map((q) => {
                       const url = `${baseUrl}/p/${encodeURIComponent(q.shareId)}`;
                       const created =
                         q.createdAt && !Number.isNaN(Date.parse(q.createdAt))
                           ? new Date(q.createdAt).toLocaleDateString("de-DE", {
                               day: "2-digit",
                               month: "2-digit",
                               year: "numeric",
                             })
                           : null;
                       return (
                         <div
                           key={q.id}
                           className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-sm shadow-black/20"
                         >
                           <div className="min-w-0">
                             <Link href={`/p/${encodeURIComponent(q.shareId)}`} className="block truncate text-slate-100 hover:text-white">
                               {q.title}
                             </Link>
                             <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                               <span className="rounded-full border border-emerald-300/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-50">
                                 Abstimmung
                               </span>
                               {created ? <span>{created}</span> : null}
                             </div>
                           </div>
                           <div className="flex shrink-0 items-center gap-2">
                             <ShareLinkButton url={url} label="Teilen" action="share" variant="icon" />
                             <ShareLinkButton url={url} label="Link kopieren" action="copy" variant="icon" />
                           </div>
                         </div>
                       );
                     })}
                     {privateDrafts.map((d) => {
                       const url = `${baseUrl}/p/${encodeURIComponent(d.shareId)}`;
                       const created =
                         d.createdAt && !Number.isNaN(Date.parse(d.createdAt))
                           ? new Date(d.createdAt).toLocaleDateString("de-DE", {
                               day: "2-digit",
                               month: "2-digit",
                               year: "numeric",
                             })
                           : null;
                       const statusLabel =
                         d.status === "accepted" ? "Angenommen" : d.status === "rejected" ? "Abgelehnt" : "Offen";
                       const statusClass =
                         d.status === "accepted"
                           ? "bg-emerald-500/15 text-emerald-100 border border-emerald-400/40"
                           : d.status === "rejected"
                             ? "bg-rose-500/15 text-rose-100 border border-rose-400/40"
                             : "bg-sky-500/15 text-sky-100 border border-sky-400/30";
                       return (
                         <div
                           key={d.id}
                           className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 shadow-sm shadow-black/20"
                         >
                           <div className="min-w-0">
                             <Link href={`/p/${encodeURIComponent(d.shareId)}`} className="block truncate text-slate-100 hover:text-white">
                               {d.title}
                             </Link>
                             <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                               <span className={`rounded-full border px-2 py-0.5 font-semibold ${statusClass}`}>
                                 {statusLabel}
                               </span>
                               {created ? <span>{created}</span> : null}
                             </div>
                           </div>
                           <div className="flex shrink-0 items-center gap-2">
                             <ShareLinkButton url={url} label="Teilen" action="share" variant="icon" />
                             <ShareLinkButton url={url} label="Link kopieren" action="copy" variant="icon" />
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}
               </>
             )}
           </div>
         </section>
       </div>
     </main>
   );
 }
