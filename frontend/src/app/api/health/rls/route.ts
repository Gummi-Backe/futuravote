import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/app/lib/supabaseClient";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export const revalidate = 0;

type TableCheck = {
  table: string;
  blocked: boolean | null;
  confidence: "verified" | "empty" | "error";
  hint?: string;
};

async function checkSensitiveTable(options: {
  table: string;
  keyColumns: string[];
}): Promise<TableCheck> {
  const admin = getSupabaseAdminClient();
  const anon = getSupabaseClient();
  const { table, keyColumns } = options;

  // Wichtig: Ein SELECT ohne Policy liefert oft 200 + leere Daten (statt Error).
  // Deshalb pruefen wir so:
  // 1) Admin holt einen existierenden Datensatz (nur Keys)
  // 2) anon versucht exakt diesen Datensatz zu lesen

  const { data: sample, error: sampleError } = await admin
    .from(table)
    .select(keyColumns.join(","))
    .limit(1)
    .maybeSingle();

  if (sampleError) {
    return {
      table,
      blocked: null,
      confidence: "error",
      hint: `Admin-Check fehlgeschlagen: ${sampleError.message}`,
    };
  }

  if (!sample) {
    return {
      table,
      blocked: null,
      confidence: "empty",
      hint: "Tabelle hat keine Daten; Zugriff kann nicht verifiziert werden.",
    };
  }

  let anonQuery = anon.from(table).select(keyColumns.join(","));
  for (const col of keyColumns) {
    const value = (sample as unknown as Record<string, unknown>)[col];
    if (value === null || typeof value === "undefined") {
      return {
        table,
        blocked: null,
        confidence: "error",
        hint: `Admin-Sample enthaelt keine Spalte '${col}'.`,
      };
    }

    anonQuery = anonQuery.eq(col, value as string);
  }

  const { data: anonRow, error: anonError } = await anonQuery.maybeSingle();
  if (anonError) {
    return {
      table,
      blocked: true,
      confidence: "verified",
    };
  }

  if (anonRow) {
    return {
      table,
      blocked: false,
      confidence: "verified",
      hint: "Anon kann einen existierenden Datensatz lesen (RLS/Policies zu offen).",
    };
  }

  return {
    table,
    blocked: true,
    confidence: "verified",
  };
}

export async function GET() {
  try {
    const checks = await Promise.all([
      checkSensitiveTable({ table: "users", keyColumns: ["id"] }),
      checkSensitiveTable({ table: "user_sessions", keyColumns: ["id"] }),
      checkSensitiveTable({ table: "email_verifications", keyColumns: ["id"] }),
      // votes hat bei uns keinen einfachen "id"-PK; wir pruefen per (question_id, session_id).
      checkSensitiveTable({ table: "votes", keyColumns: ["question_id", "session_id"] }),
    ]);

    const strictOk = checks.every((c) => c.blocked === true);
    const ok = checks.every((c) => c.blocked !== false);

    return NextResponse.json(
      {
        ok,
        strictOk,
        checks,
        note: strictOk
          ? "RLS scheint korrekt: anon kann keine sensitiven Datensaetze lesen."
          : ok
          ? "Mindestens eine Tabelle ist leer oder konnte nicht verifiziert werden."
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
