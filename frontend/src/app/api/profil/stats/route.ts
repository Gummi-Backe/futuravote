import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const reviewSessionId = cookieStore.get("fv_session")?.value ?? null;
  if (!sessionId) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const user = await getUserBySessionSupabase(sessionId);
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  // Draft-Statistiken (als Ersteller)
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

  // Frage-Votes (als Waehler)
  const { count: votesTotal } = await supabase
    .from("votes")
    .select("question_id", { count: "exact", head: true })
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

  // Track-Record: Wie oft lag der Nutzer nach Aufloesung richtig/falsch?
  // Hinweis: Wir deduplizieren pro Question (falls User z.B. auf mehreren Geraeten gevotet hat).
  let trackTotal = 0;
  let trackCorrect = 0;
  let trackIncorrect = 0;
  let trackAccuracyPct: number | null = null;
  let trackByCategory: { category: string; total: number; correct: number; incorrect: number; accuracyPct: number | null }[] =
    [];
  let pointsTotal = 0;
  let pointsTier: "none" | "bronze" | "silver" | "gold" = "none";
  let badges: { id: string; label: string; description: string }[] = [];

  try {
    const { data: voteRows, error: votesError } = await supabase
      .from("votes")
      .select("question_id, choice, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5000);

    if (votesError) {
      throw votesError;
    }

    const perQuestion = new Map<string, "yes" | "no">();
    ((voteRows ?? []) as { question_id: string; choice: "yes" | "no" }[]).forEach((v) => {
      if (!v?.question_id || !v?.choice) return;
      if (perQuestion.has(v.question_id)) return;
      perQuestion.set(v.question_id, v.choice);
    });

    const questionIds = Array.from(perQuestion.keys());
    if (questionIds.length > 0) {
      const byId = new Map<string, { resolvedOutcome: "yes" | "no" | null; category: string }>();
      const chunkSize = 500;
      for (let i = 0; i < questionIds.length; i += chunkSize) {
        const chunk = questionIds.slice(i, i + chunkSize);
        const { data: questionRows, error: qErr } = await supabase
          .from("questions")
          .select("id, resolved_outcome, category")
          .in("id", chunk);
        if (qErr) throw qErr;
        ((questionRows ?? []) as { id: string; resolved_outcome: "yes" | "no" | null; category: string | null }[]).forEach(
          (q) => {
            byId.set(q.id, { resolvedOutcome: q.resolved_outcome ?? null, category: q.category ?? "Sonstiges" });
          }
        );
      }

      const categoryMap = new Map<string, { category: string; total: number; correct: number; incorrect: number }>();
      perQuestion.forEach((choice, questionId) => {
        const meta = byId.get(questionId);
        const resolved = meta?.resolvedOutcome ?? null;
        if (!resolved) return;

        trackTotal += 1;
        const ok = choice === resolved;
        if (ok) trackCorrect += 1;
        else trackIncorrect += 1;

        const category = meta?.category ?? "Sonstiges";
        const cur = categoryMap.get(category) ?? { category, total: 0, correct: 0, incorrect: 0 };
        cur.total += 1;
        if (ok) cur.correct += 1;
        else cur.incorrect += 1;
        categoryMap.set(category, cur);
      });

      trackAccuracyPct = trackTotal > 0 ? Math.round((trackCorrect / trackTotal) * 100) : null;
      trackByCategory = Array.from(categoryMap.values())
        .map((c) => ({
          ...c,
          accuracyPct: c.total > 0 ? Math.round((c.correct / c.total) * 100) : null,
        }))
        .sort((a, b) => (b.total - a.total) || ((b.accuracyPct ?? 0) - (a.accuracyPct ?? 0)))
        .slice(0, 5);

      // Punkte/Badges (ohne Geld): einfache, transparente Basis-Logik.
      // Punkte werden nur fuer richtige Prognosen nach Aufloesung vergeben.
      pointsTotal = Math.max(0, trackCorrect) * 10;
      if (pointsTotal >= 200) pointsTier = "gold";
      else if (pointsTotal >= 50) pointsTier = "silver";
      else if (pointsTotal >= 10) pointsTier = "bronze";

      const computedBadges: { id: string; label: string; description: string }[] = [];
      if (trackCorrect >= 1) {
        computedBadges.push({
          id: "first_hit",
          label: "Erster Treffer",
          description: "Du hast eine aufgelöste Frage richtig vorhergesagt.",
        });
      }
      if (trackCorrect >= 5) {
        computedBadges.push({
          id: "sharp",
          label: "Treffsicher",
          description: "Mindestens 5 richtige Prognosen bei aufgelösten Fragen.",
        });
      }
      if (trackCorrect >= 20) {
        computedBadges.push({
          id: "pro",
          label: "Prognose‑Profi",
          description: "Mindestens 20 richtige Prognosen bei aufgelösten Fragen.",
        });
      }
      if (trackTotal >= 10 && trackIncorrect === 0) {
        computedBadges.push({
          id: "perfect_10",
          label: "10/10",
          description: "10 entschiedene Fragen – alle richtig.",
        });
      }
      badges = computedBadges;
    }
  } catch {
    trackTotal = 0;
    trackCorrect = 0;
    trackIncorrect = 0;
    trackAccuracyPct = null;
    trackByCategory = [];
    pointsTotal = 0;
    pointsTier = "none";
    badges = [];
  }

  // Top-Kategorien aus den eigenen Votes (limitiert, damit es auch bei vielen Votes schnell bleibt)
  let topCategories: { category: string; votes: number; yes: number; no: number }[] = [];
  try {
    const { data: voteRows } = await supabase
      .from("votes")
      .select("question_id, choice, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(2000);

    const rows = (voteRows ?? []) as { question_id: string; choice: "yes" | "no" }[];
    if (rows.length > 0) {
      const questionIds = Array.from(new Set(rows.map((v) => v.question_id).filter(Boolean)));

      const categoryById = new Map<string, string>();
      const chunkSize = 500;
      for (let i = 0; i < questionIds.length; i += chunkSize) {
        const chunk = questionIds.slice(i, i + chunkSize);
        const { data: questionRows } = await supabase.from("questions").select("id, category").in("id", chunk);
        (questionRows as { id: string; category: string | null }[] | null | undefined)?.forEach((q) => {
          categoryById.set(q.id, q.category ?? "Sonstiges");
        });
      }

      const statsMap = new Map<string, { category: string; votes: number; yes: number; no: number }>();
      rows.forEach((vote) => {
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
  } catch {
    topCategories = [];
  }

  return NextResponse.json({
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
    trackTotal,
    trackCorrect,
    trackIncorrect,
    trackAccuracyPct,
    trackByCategory,
    pointsTotal,
    pointsTier,
    badges,
  });
}
