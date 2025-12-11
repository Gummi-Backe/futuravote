import { randomUUID } from "crypto";
import { getSupabaseClient } from "@/app/lib/supabaseClient";

export type UserRole = "user" | "admin";

export type DbUser = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: UserRole;
  created_at: string;
   default_region: string | null;
};

export type User = {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  createdAt: string;
   defaultRegion: string | null;
};

export function mapUser(row: DbUser): User {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: (row.role as UserRole) ?? "user",
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
  const supabase = getSupabaseClient();
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

export async function getUserByEmailSupabase(email: string): Promise<User | null> {
  const supabase = getSupabaseClient();

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
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();
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
  const supabase = getSupabaseClient();

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
  const supabase = getSupabaseClient();

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
