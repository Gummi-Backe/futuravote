import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getUserBySessionSupabase } from "@/app/data/dbSupabaseUsers";
import { getSupabaseClient } from "@/app/lib/supabaseClient";

export const revalidate = 0;

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

  const supabase = getSupabaseClient();

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

  return NextResponse.json({
    draftsTotal: draftsTotal ?? 0,
    draftsAccepted: draftsAccepted ?? 0,
    draftsRejected: draftsRejected ?? 0,
    votesTotal: votesTotal ?? 0,
  });
}

