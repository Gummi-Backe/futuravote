import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

type DraftRow = {
  id: string;
  title: string;
  status: string | null;
  created_at: string | null;
  visibility: string | null;
};

export async function GET() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get("fv_user")?.value;
  if (!sessionId) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const user = await getUserBySessionSupabase(sessionId);
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("drafts")
    .select("id,title,status,created_at,visibility")
    .eq("creator_id", user.id)
    .or("visibility.is.null,visibility.neq.link_only")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: "Konnte Drafts nicht laden." }, { status: 500 });
  }

  const drafts = ((data ?? []) as DraftRow[]).map((d) => ({
    id: d.id,
    title: d.title,
    status: d.status ?? "open",
    createdAt: d.created_at ?? null,
  }));

  return NextResponse.json({ drafts }, { status: 200 });
}

