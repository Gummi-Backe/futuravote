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
      scope,
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
  if (!data) return null;
  const user = getRelatedUser(data as OauthTokenUserRow);
  if (!user) return null;

  return mapUser(user);
}

export type OauthAccessContext = {
  user: User;
  scope: string;
};

export async function getOauthAccessContextByTokenSupabase(accessToken: string): Promise<OauthAccessContext | null> {
  const token = accessToken.trim();
  if (!token) return null;

  const supabase = getSupabaseAdminClient();
  const hash = sha256Hex(token);

  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from("oauth_tokens")
    .select(
      `
      scope,
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
    throw new Error(`Supabase getOauthAccessContextByToken fehlgeschlagen: ${error.message}`);
  }
  if (!data) return null;
  const row = data as OauthTokenUserRow;
  const user = getRelatedUser(row);
  if (!user) return null;

  return {
    user: mapUser(user),
    scope: String(row.scope ?? ""),
  };
}
type OauthTokenUserRow = { users: DbUser | DbUser[] | null; scope?: string | null };

function getRelatedUser(row: OauthTokenUserRow): DbUser | null {
  return Array.isArray(row.users) ? row.users[0] ?? null : row.users;
}
