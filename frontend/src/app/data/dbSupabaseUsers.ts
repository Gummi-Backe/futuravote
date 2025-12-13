import "server-only";

import { createHash, randomBytes, randomUUID } from "crypto";
import { getSupabaseAdminClient } from "@/app/lib/supabaseAdminClient";

export type UserRole = "user" | "admin";

export type DbUser = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
  email_verified: boolean;
  created_at: string;
   default_region: string | null;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
  emailVerified: boolean;
   defaultRegion: string | null;
};

export function mapUser(row: DbUser): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: (row.role as UserRole) ?? "user",
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at,
    defaultRegion: row.default_region ?? null,
  };
}

export async function createUserSupabase(input: {
  email: string;
  passwordHash: string;
  displayName: string;
  role?: UserRole;
  defaultRegion?: string | null;
}): Promise<User> {
  const supabase = getSupabaseAdminClient();
  const id = randomUUID();
  const role: UserRole = input.role ?? "user";
  const defaultRegion = input.defaultRegion ?? null;

  const { data, error } = await supabase
    .from("users")
    .insert({
      id,
      email: input.email,
      password_hash: input.passwordHash,
      display_name: input.displayName,
      role,
      default_region: defaultRegion,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase createUser fehlgeschlagen: ${error.message}`);
  }
  if (!data) {
    throw new Error("Supabase createUser lieferte keine Daten zurueck.");
  }

  return mapUser(data as DbUser);
}

export async function getUserPasswordHashByEmailSupabase(email: string): Promise<string | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("users")
    .select("password_hash")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase getUserPasswordHashByEmail fehlgeschlagen: ${error.message}`);
  }

  return (data as any)?.password_hash ?? null;
}


export async function createEmailVerificationTokenSupabase(
  userId: string,
  ttlHours: number = 24
): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const id = randomUUID();
  const token = randomUUID();
  const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000).toISOString();

  // Alte Tokens fuer den Nutzer aufraeumen
  await supabase.from("email_verifications").delete().eq("user_id", userId);

  const { error } = await supabase.from("email_verifications").insert({
    id,
    user_id: userId,
    token,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Supabase createEmailVerificationToken fehlgeschlagen: ${error.message}`);
  }

  return token;
}

export async function verifyEmailByTokenSupabase(token: string): Promise<User | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("email_verifications")
    .select(
      `
        id,
        user_id,
        expires_at,
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
    .eq("token", token)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase verifyEmailByToken Select fehlgeschlagen: ${error.message}`);
  }
  if (!data || !(data as any).users) {
    return null;
  }

  const row = data as any;
  const expiresAt = Date.parse(row.expires_at as string);
  if (Number.isNaN(expiresAt) || expiresAt < Date.now()) {
    // Abgelaufenes Token loeschen
    await supabase.from("email_verifications").delete().eq("id", row.id as string);
    return null;
  }

  const userRow = row.users as DbUser;

  if (!userRow.email_verified) {
    const { error: updateError } = await supabase
      .from("users")
      .update({ email_verified: true })
      .eq("id", userRow.id);

    if (updateError) {
      throw new Error(`Supabase verifyEmailByToken Update fehlgeschlagen: ${updateError.message}`);
    }

    userRow.email_verified = true;
  }

  // Alle Tokens fuer diesen Nutzer entfernen
  await supabase.from("email_verifications").delete().eq("user_id", userRow.id);

  return mapUser(userRow);
}

export async function getUserByEmailSupabase(email: string): Promise<User | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("email", email)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase getUserByEmail fehlgeschlagen: ${error.message}`);
  }
  if (!data) return null;

  return mapUser(data as DbUser);
}

export async function hasAdminUserSupabase(): Promise<boolean> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select("id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    // PGRST116 = no rows found
    throw new Error(`Supabase hasAdminUser fehlgeschlagen: ${error.message}`);
  }

  return !!data;
}

export async function createUserSessionSupabase(userId: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const id = randomUUID();

  const { error } = await supabase.from("user_sessions").insert({
    id,
    user_id: userId,
  });

  if (error) {
    throw new Error(`Supabase createUserSession fehlgeschlagen: ${error.message}`);
  }

  return id;
}

export async function getUserBySessionSupabase(sessionId: string): Promise<User | null> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("user_sessions")
    .select(
      `
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
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase getUserBySession fehlgeschlagen: ${error.message}`);
  }
  if (!data || !("users" in data) || !data.users) return null;

  const userRow = (data as any).users as DbUser;
  return mapUser(userRow);
}

export async function updateUserDefaultRegionSupabase(
  userId: string,
  region: string | null
): Promise<User> {
  const supabase = getSupabaseAdminClient();

  const { data, error } = await supabase
    .from("users")
    .update({ default_region: region })
    .eq("id", userId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase updateUserDefaultRegion fehlgeschlagen: ${error.message}`);
  }
  if (!data) {
    throw new Error("Supabase updateUserDefaultRegion lieferte keine Daten zurueck.");
  }

  return mapUser(data as DbUser);
}
function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function createPasswordResetTokenSupabase(options: {
  userId: string;
  ttlMinutes?: number;
}): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const token = randomBytes(32).toString("hex");
  const tokenHash = sha256Hex(token);
  const ttlMinutes = options.ttlMinutes ?? 60;
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString();

  // Vorherige Tokens fuer den Nutzer aufraeumen
  await supabase.from("password_resets").delete().eq("user_id", options.userId);

  const { error } = await supabase.from("password_resets").insert({
    user_id: options.userId,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(`Supabase createPasswordResetToken fehlgeschlagen: ${error.message}`);
  }

  return token;
}

export async function resetPasswordByTokenSupabase(options: {
  token: string;
  newPasswordHash: string;
}): Promise<{ ok: boolean; reason?: "invalid" | "expired" | "used" }> {
  const supabase = getSupabaseAdminClient();
  const tokenHash = sha256Hex(options.token);

  const { data, error } = await supabase
    .from("password_resets")
    .select("id, user_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase resetPasswordByToken (select) fehlgeschlagen: ${error.message}`);
  }
  if (!data) {
    return { ok: false, reason: "invalid" };
  }

  const row = data as any;
  if (row.used_at) {
    return { ok: false, reason: "used" };
  }

  const expiresMs = Date.parse(row.expires_at as string);
  if (Number.isNaN(expiresMs) || expiresMs < Date.now()) {
    // Abgelaufene Tokens entfernen
    await supabase.from("password_resets").delete().eq("id", row.id as string);
    return { ok: false, reason: "expired" };
  }

  const userId = row.user_id as string;

  const { error: updateUserError } = await supabase
    .from("users")
    .update({ password_hash: options.newPasswordHash })
    .eq("id", userId);

  if (updateUserError) {
    throw new Error(`Supabase resetPasswordByToken (update user) fehlgeschlagen: ${updateUserError.message}`);
  }

  const { error: markUsedError } = await supabase
    .from("password_resets")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id as string);

  if (markUsedError) {
    throw new Error(`Supabase resetPasswordByToken (mark used) fehlgeschlagen: ${markUsedError.message}`);
  }

  // Alle Sessions des Users invalidieren
  await supabase.from("user_sessions").delete().eq("user_id", userId);

  return { ok: true };
}
