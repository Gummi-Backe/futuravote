import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";

export const revalidate = 0;

type ReportStatus = "open" | "resolved" | "dismissed";

type UpdateBody = {
  id?: string;
  status?: ReportStatus;
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

  return NextResponse.json({ reports: data ?? [], status }, { status: 200 });
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
