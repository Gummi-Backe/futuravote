import "server-only";

import { createHash } from "crypto";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";
import { mapUser, type DbUser, type User } from "@/app/data/dbSupabaseUsers";

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function getUserByOauthAccessTokenSupabase(accessToken: string): Promise<User | null> {
  const token = accessToken.trim();
  if (!token) return null;

  const supabase = getSupabaseAdminClient();
  const hash = sha256Hex(token);

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("oauth_tokens")
    .select(
      `
      access_expires_at,
      revoked_at,
      users (
        id,
        email,
        password_hash,
        display_name,
        role,
        email_verified,
        created_at,
        default_region
      )
    `
    )
    .eq("access_token_hash", hash)
    .is("revoked_at", null)
    .gt("access_expires_at", nowIso)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase getUserByOauthAccessToken fehlgeschlagen: ${error.message}`);
  }
  if (!data || !(data as any).users) return null;

  return mapUser((data as any).users as DbUser);
}

