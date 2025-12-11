import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/app/lib/supabaseClient";

export const revalidate = 0;

export async function GET() {
  try {
    const supabase = getSupabaseClient();

    // Einfacher Test: Anzahl der Fragen in Supabase zählen
    const { count, error } = await supabase
      .from("questions")
      .select("id", { count: "exact", head: true });

    if (error) {
      console.error("Supabase health check failed:", error);
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, questionsInSupabase: count ?? 0 });
  } catch (err: any) {
    console.error("Supabase health check threw:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unbekannter Fehler beim Supabase-Healthcheck",
      },
      { status: 500 }
    );
  }
}

