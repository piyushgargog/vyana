import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forbidden, unauthorized } from "./errors";
import { supabaseAdmin, supabaseForUser } from "./supabase-admin";

export type Role = "patient" | "doctor" | "admin";

/** The `profiles` columns the backend relies on (PLAN §5.1). Other columns pass through untyped. */
export interface Profile {
  id: string;
  role: Role;
  full_name: string | null;
  [column: string]: unknown;
}

export interface AuthedUser {
  user: { id: string; email: string | null };
  profile: Profile;
  /** Acts as this user: every query goes through RLS. */
  sb: SupabaseClient;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

/**
 * Verifies `Authorization: Bearer <supabase access_token>` and loads the caller's profile (SPEC §0).
 * Missing, invalid or expired token → 401 `UNAUTHORIZED`.
 */
export async function requireUser(req: Request): Promise<AuthedUser> {
  const token = bearerToken(req);
  if (!token) throw unauthorized();

  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data.user) throw unauthorized("Your session has expired. Sign in again.");

  const sb = supabaseForUser(token);
  const { data: profile, error: profileError } = await sb.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile) throw unauthorized("Your account isn't set up yet. Sign in again.");

  return { user: { id: data.user.id, email: data.user.email ?? null }, profile: profile as Profile, sb };
}

/** Wrong role → 403 `FORBIDDEN`. */
export function requireRole(profile: Profile, ...roles: Role[]): void {
  if (!roles.includes(profile.role)) throw forbidden();
}
