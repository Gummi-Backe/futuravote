import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

function daysAgoIso(days: number): string {
  const ms = Date.now() - Math.max(0, days) * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId).catch(() => null) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins duerfen diese Route nutzen." }, { status: 403 });
  }

  const supabase = getSupabaseAdminClient();
  const since7d = daysAgoIso(7);

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

    const [pageViews7d, votes7d, draftReviews7d, shares7d, copies7d, logins7d, registers7d] = await Promise.all([
      countEvent("page_view"),
      countEvent("vote_question"),
      countEvent("review_draft"),
      countEvent("share"),
      countEvent("copy"),
      countEvent("login"),
      countEvent("register"),
    ]);

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

    return NextResponse.json(
      {
        ok: true,
        since7d,
        summary: {
          uniqueSessions7d: uniqueSessions.size,
          pageViews7d,
          votes7d,
          draftReviews7d,
          shares7d,
          copies7d,
          logins7d,
          registers7d,
          sampleLimits: { uniqueSessions: 5000, topPages: 5000 },
        },
        topPages,
        latest: latestRows ?? [],
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const code = (e as any)?.code as string | undefined;
    if (code === "42P01") {
      return NextResponse.json(
        { error: "Supabase table 'analytics_events' fehlt. Fuehre supabase/analytics_events.sql aus." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Analytics konnten nicht geladen werden." }, { status: 500 });
  }
}

