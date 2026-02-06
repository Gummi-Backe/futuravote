import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getAdminSettings } from "@/app/lib/adminSettings";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

type ReportStatus = "open" | "resolved" | "dismissed";

type UpdateBody = {
  id?: string;
  status?: ReportStatus;
};

type ReportRow = {
  id: string;
  kind: "question" | "draft";
  item_id: string;
  item_title: string | null;
  share_id: string | null;
  reason: string;
  message: string | null;
  page_url: string | null;
  reporter_session_id: string | null;
  reporter_user_id: string | null;
  status: ReportStatus;
  created_at: string;
  report_count?: number;
  is_quarantined?: boolean;
};

function normalizeStatus(input: string | null): ReportStatus {
  if (input === "resolved" || input === "dismissed" || input === "open") return input;
  return "open";
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins dürfen diese Route nutzen." }, { status: 403 });
  }

  const url = new URL(request.url);
  const status = normalizeStatus(url.searchParams.get("status"));
  const limitRaw = url.searchParams.get("limit");
  const limit = Math.min(200, Math.max(1, Number(limitRaw ?? 100) || 100));

  const supabase = getSupabaseAdminClient();
  const query = supabase
    .from("reports")
    .select("id,kind,item_id,item_title,share_id,reason,message,page_url,reporter_session_id,reporter_user_id,status,created_at")
    .eq("status", status)
    .order("created_at", { ascending: false })
    .limit(limit);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: `Reports konnten nicht geladen werden: ${error.message}` }, { status: 500 });
  }

  const reports = ((data ?? []) as ReportRow[]).map((r) => ({
    ...r,
    report_count: 0,
    is_quarantined: false,
  }));

  if (reports.length === 0) {
    return NextResponse.json({ reports, status }, { status: 200 });
  }

  const relevantKinds = Array.from(new Set(reports.map((r) => r.kind)));
  const relevantItemIds = Array.from(new Set(reports.map((r) => r.item_id)));

  const [settings, openCountsResult] = await Promise.all([
    getAdminSettings(),
    supabase
      .from("reports")
      .select("kind,item_id")
      .eq("status", "open")
      .in("kind", relevantKinds)
      .in("item_id", relevantItemIds),
  ]);

  if (openCountsResult.error) {
    return NextResponse.json(
      { error: `Reports konnten nicht priorisiert werden: ${openCountsResult.error.message}` },
      { status: 500 }
    );
  }

  const quarantineThreshold = Math.max(1, settings.reportQuarantineThreshold);
  const countsByItem = new Map<string, number>();
  for (const row of (openCountsResult.data ?? []) as Array<{ kind: string; item_id: string }>) {
    const key = `${row.kind}:${row.item_id}`;
    countsByItem.set(key, (countsByItem.get(key) ?? 0) + 1);
  }

  const enriched = reports.map((r) => {
    const reportCount = countsByItem.get(`${r.kind}:${r.item_id}`) ?? 0;
    const isQuarantined = reportCount >= quarantineThreshold;
    return {
      ...r,
      report_count: reportCount,
      is_quarantined: isQuarantined,
    };
  });

  if (status !== "open") {
    return NextResponse.json({ reports: enriched, status }, { status: 200 });
  }

  enriched.sort((a, b) => {
    const aq = a.is_quarantined ? 1 : 0;
    const bq = b.is_quarantined ? 1 : 0;
    if (aq !== bq) return bq - aq;

    const ac = a.report_count ?? 0;
    const bc = b.report_count ?? 0;
    if (ac !== bc) return bc - ac;

    const at = Date.parse(a.created_at);
    const bt = Date.parse(b.created_at);
    if (Number.isFinite(at) && Number.isFinite(bt)) return bt - at;
    return 0;
  });

  return NextResponse.json({ reports: enriched, status }, { status: 200 });
}

export async function PATCH(request: Request) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  const user = sessionId ? await getUserBySessionSupabase(sessionId) : null;

  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins dürfen diese Aktion ausführen." }, { status: 403 });
  }

  let body: UpdateBody;
  try {
    body = (await request.json()) as UpdateBody;
  } catch {
    return NextResponse.json({ error: "Ungültiger Request-Body." }, { status: 400 });
  }

  const id = body.id?.trim();
  const status = body.status;
  if (!id) {
    return NextResponse.json({ error: "Report-ID fehlt." }, { status: 400 });
  }
  if (status !== "open" && status !== "resolved" && status !== "dismissed") {
    return NextResponse.json({ error: "Ungültiger Status." }, { status: 400 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("reports")
    .update({ status })
    .eq("id", id)
    .select("id,status")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: `Update fehlgeschlagen: ${error.message}` }, { status: 500 });
  }

  return NextResponse.json({ ok: true, report: data }, { status: 200 });
}
