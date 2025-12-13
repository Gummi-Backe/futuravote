import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/app/lib/supabaseClient";

export const revalidate = 0;

type TableCheck = {
  table: string;
  blocked: boolean;
  hint?: string;
};

async function checkAnonBlocked(table: string): Promise<TableCheck> {
  const supabase = getSupabaseClient();

  // Wenn RLS greift und keine Policy existiert, sollte dieses Select fehlschlagen.
  const { error } = await supabase.from(table).select("id", { count: "exact", head: true }).limit(1);

  if (!error) {
    return {
      table,
      blocked: false,
      hint: "Anon kann SELECT ausfuehren (RLS/Policies zu offen?)",
    };
  }

  return {
    table,
    blocked: true,
  };
}

export async function GET() {
  try {
    const tables = ["users", "user_sessions", "email_verifications", "votes"];
    const checks = await Promise.all(tables.map((t) => checkAnonBlocked(t)));

    const ok = checks.every((c) => c.blocked);

    return NextResponse.json(
      {
        ok,
        checks,
        note: ok
          ? "RLS scheint korrekt: anon wird auf sensitiven Tabellen blockiert."
          : "RLS-Check fehlgeschlagen: mind. eine sensitive Tabelle ist fuer anon lesbar.",
      },
      { status: ok ? 200 : 500 }
    );
  } catch (err) {
    console.error("RLS health check threw:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unbekannter Fehler",
      },
      { status: 500 }
    );
  }
}
