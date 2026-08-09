import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getErrorCode } from "@/app/lib/unknownValue";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

function daysAgoIso(days: number): string {
  const ms = Date.now() - Math.max(0, days) * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

function pct(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId).catch(() => null) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
  }

  const supabase = getSupabaseAdminClient();
  const since7d = daysAgoIso(7);
  const since30d = daysAgoIso(30);

  try {
    const countEvent = async (event: string) => {
      const { count, error } = await supabase
        .from("analytics_events")
        .select("id", { count: "exact", head: true })
        .gte("created_at", since7d)
        .eq("event", event);
      if (error) throw error;
      return count ?? 0;
    };

    const [
      pageViews7d,
      votes7d,
      draftReviews7d,
      shares7d,
      copies7d,
      logins7d,
      registers7d,
      referralVisits7d,
      referralVotes7d,
    ] = await Promise.all([
      countEvent("page_view"),
      countEvent("vote_question"),
      countEvent("review_draft"),
      countEvent("share"),
      countEvent("copy"),
      countEvent("login"),
      countEvent("register"),
      countEvent("referral_visit"),
      countEvent("referral_vote"),
    ]);

    const { data: mauRows, error: mauError } = await supabase
      .from("analytics_events")
      .select("session_id")
      .gte("created_at", since30d)
      .limit(10000);
    if (mauError) throw mauError;
    const uniqueSessions30d = new Set(
      ((mauRows ?? []) as { session_id?: string }[])
        .map((r) => r.session_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    );

    const { data: sessionRows, error: sessError } = await supabase
      .from("analytics_events")
      .select("session_id")
      .gte("created_at", since7d)
      .limit(5000);
    if (sessError) throw sessError;
    const uniqueSessions = new Set(
      ((sessionRows ?? []) as { session_id?: string }[])
        .map((r) => r.session_id)
        .filter((v): v is string => typeof v === "string" && v.length > 0)
    );

    const { data: pvRows, error: pvError } = await supabase
      .from("analytics_events")
      .select("path")
      .gte("created_at", since7d)
      .eq("event", "page_view")
      .limit(5000);
    if (pvError) throw pvError;

    const pageCounts = new Map<string, number>();
    for (const row of (pvRows ?? []) as { path?: string | null }[]) {
      const p = typeof row.path === "string" ? row.path : null;
      if (!p) continue;
      pageCounts.set(p, (pageCounts.get(p) ?? 0) + 1);
    }

    const topPages = Array.from(pageCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([path, count]) => ({ path, count }));

    const { data: latestRows, error: latestError } = await supabase
      .from("analytics_events")
      .select("event,path,created_at,meta")
      .order("created_at", { ascending: false })
      .limit(60);
    if (latestError) throw latestError;

    const { data: referralVoteRows, error: referralVoteRowsError } = await supabase
      .from("analytics_events")
      .select("meta")
      .gte("created_at", since7d)
      .eq("event", "referral_vote")
      .limit(10000);
    if (referralVoteRowsError) throw referralVoteRowsError;

    const referralByUserId = new Map<string, number>();
    for (const row of (referralVoteRows ?? []) as { meta?: { sharerUserId?: string | null } | null }[]) {
      const sharer = row?.meta?.sharerUserId;
      if (!sharer || typeof sharer !== "string") continue;
      referralByUserId.set(sharer, (referralByUserId.get(sharer) ?? 0) + 1);
    }

    const topSharerIds = Array.from(referralByUserId.keys()).slice(0, 50);
    const sharerNameById = new Map<string, string>();
    if (topSharerIds.length > 0) {
      const { data: sharerRows, error: sharerRowsError } = await supabase
        .from("users")
        .select("id,display_name")
        .in("id", topSharerIds);
      if (sharerRowsError) throw sharerRowsError;
      for (const row of (sharerRows ?? []) as { id: string; display_name?: string | null }[]) {
        sharerNameById.set(String(row.id), String(row.display_name ?? "User"));
      }
    }

    const topSharers = Array.from(referralByUserId.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([userId, conversions]) => ({
        userId,
        displayName: sharerNameById.get(userId) ?? "User",
        conversions,
      }));

    const sharesAndCopies7d = shares7d + copies7d;
    const shareToVisitPct = pct(referralVisits7d, sharesAndCopies7d);
    const visitToVotePct = pct(referralVotes7d, referralVisits7d);
    const shareToVotePct = pct(referralVotes7d, sharesAndCopies7d);

    return NextResponse.json(
      {
        ok: true,
        since7d,
        since30d,
        summary: {
          uniqueSessions7d: uniqueSessions.size,
          uniqueSessions30d: uniqueSessions30d.size,
          pageViews7d,
          votes7d,
          draftReviews7d,
          shares7d,
          copies7d,
          logins7d,
          registers7d,
          referralVisits7d,
          referralVotes7d,
          sharesAndCopies7d,
          shareToVisitPct,
          visitToVotePct,
          shareToVotePct,
          sampleLimits: { uniqueSessions: 5000, topPages: 5000 },
        },
        kpis: {
          growth: {
            wau: uniqueSessions.size,
            mau: uniqueSessions30d.size,
            wauMauRatioPct: pct(uniqueSessions.size, uniqueSessions30d.size),
          },
          referral: {
            sharesAndCopies7d,
            referralVisits7d,
            referralVotes7d,
            shareToVisitPct,
            visitToVotePct,
            shareToVotePct,
          },
          topSharers,
        },
        topPages,
        latest: latestRows ?? [],
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const code = getErrorCode(e);
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Supabase table 'analytics_events' fehlt. Fuehre supabase/analytics_events.sql aus." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Analytics konnten nicht geladen werden." }, { status: 500 });
  }
}
