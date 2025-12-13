import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseAdmin: SupabaseClient | null = null;

/**
 * Supabase-Client fuer serverseitige DB-Operationen.
 * Verwendet bevorzugt den Service-Role-Key und faellt sonst auf den anon-Key zurueck.
 * Der Service-Role-Key darf niemals im Client landen.
 */
export function getSupabaseAdminClient(): SupabaseClient {
  if (supabaseAdmin) {
    return supabaseAdmin;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("Supabase URL fehlt (NEXT_PUBLIC_SUPABASE_URL ist nicht gesetzt).");
  }

  const keyToUse = serviceRoleKey || anonKey;
  if (!keyToUse) {
    throw new Error(
      "Kein Supabase-Key verfuegbar. Bitte SUPABASE_SERVICE_ROLE_KEY (empfohlen) oder NEXT_PUBLIC_SUPABASE_ANON_KEY setzen."
    );
  }

  if (!serviceRoleKey) {
    console.warn(
      "Warnung: SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt. Mit aktivierter RLS werden viele Operationen fehlschlagen."
    );
  }

  supabaseAdmin = createClient(url, keyToUse, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseAdmin;
}
