import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Reads a required server env var. Missing config is a deploy bug, so it fails loudly instead of using a placeholder. */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}`);
  return value;
}

let admin: SupabaseClient | undefined;

/**
 * Service-role client. It bypasses RLS, so use it only for server-owned writes and lookups listed in
 * docs/DATABASE.md, always after an explicit ownership check. Created on first use so builds don't need the key.
 */
export function supabaseAdmin(): SupabaseClient {
  admin ??= createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return admin;
}

/** A client that acts as the signed-in user, so RLS applies to every query it makes. */
export function supabaseForUser(accessToken: string): SupabaseClient {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
