import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

function isVercelCron(request: Request): boolean {
  const header = request.headers.get("x-vercel-cron");
  return header === "1" || header === "true";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const daysBackRaw = Number(url.searchParams.get("daysBack") ?? "120");
  const daysBack = Number.isFinite(daysBackRaw) ? Math.max(1, Math.min(3650, Math.trunc(daysBackRaw))) : 120;

  const secret = process.env.FV_CRON_SECRET?.trim() ?? "";
  const providedSecret = url.searchParams.get("secret") ?? "";

  if (!isVercelCron(request) && secret && providedSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase.rpc("refresh_question_metrics_daily", {
    days_back: daysBack,
  });

  if (error) {
    console.error("refresh_question_metrics_daily failed", error);
    return NextResponse.json(
      {
        ok: false,
        error: "Snapshot konnte nicht erstellt werden. SQL-Funktion vorhanden?",
        hint: "Fuehre `supabase/question_metrics_daily.sql` in Supabase aus (inkl. Options-Snapshots) und stelle sicher, dass die Funktion `refresh_question_metrics_daily` existiert.",
        details: error.message,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, result: data });
}
