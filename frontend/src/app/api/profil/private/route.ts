import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

type PrivateQuestionRow = {
  id: string;
  title: string;
  share_id: string | null;
  created_at: string | null;
  status: string | null;
  visibility: string | null;
};

type PrivateDraftRow = {
  id: string;
  title: string;
  share_id: string | null;
  created_at: string | null;
  status: string | null;
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

  const { data: qData, error: qError } = await supabase
    .from("questions")
    .select("id,title,share_id,created_at,status,visibility")
    .eq("creator_id", user.id)
    .eq("visibility", "link_only")
    .not("share_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (qError) {
    return NextResponse.json({ error: "Konnte private Umfragen nicht laden." }, { status: 500 });
  }

  const { data: dData, error: dError } = await supabase
    .from("drafts")
    .select("id,title,share_id,created_at,status,visibility")
    .eq("creator_id", user.id)
    .eq("visibility", "link_only")
    .not("share_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(10);

  if (dError) {
    return NextResponse.json({ error: "Konnte private Umfragen nicht laden." }, { status: 500 });
  }

  const privateQuestions = ((qData ?? []) as PrivateQuestionRow[])
    .filter((q) => Boolean(q.share_id))
    .map((q) => ({
      id: q.id,
      title: q.title,
      shareId: q.share_id as string,
      createdAt: q.created_at ?? null,
      status: q.status ?? "new",
    }));

  const privateDrafts = ((dData ?? []) as PrivateDraftRow[])
    .filter((d) => Boolean(d.share_id))
    .map((d) => ({
      id: d.id,
      title: d.title,
      shareId: d.share_id as string,
      createdAt: d.created_at ?? null,
      status: d.status ?? "open",
    }));

  return NextResponse.json({ privateQuestions, privateDrafts }, { status: 200 });
}

