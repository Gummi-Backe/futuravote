import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let supabaseServer: SupabaseClient | null = null;

/**
 * Supabase-Client für serverseitige Operationen (z.B. Storage).
 * Verwendet bevorzugt den Service-Role-Key und fällt sonst auf den anon-Key zurück.
 * Der Service-Role-Key wird niemals an den Client gebunden.
 */
export function getSupabaseServerClient(): SupabaseClient {
  if (supabaseServer) {
    return supabaseServer;
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
      "Kein Supabase-Key verfügbar. Bitte SUPABASE_SERVICE_ROLE_KEY (empfohlen) oder NEXT_PUBLIC_SUPABASE_ANON_KEY setzen."
    );
  }

  if (!serviceRoleKey) {
    console.warn(
      "Warnung: SUPABASE_SERVICE_ROLE_KEY ist nicht gesetzt. Serverseitige Vorgänge (z.B. Storage) laufen derzeit mit dem anon-Key."
    );
  }

  supabaseServer = createClient(url, keyToUse, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseServer;
}

