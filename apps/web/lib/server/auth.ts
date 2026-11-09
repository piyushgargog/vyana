import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { forbidden, unauthorized } from "./errors";
import { requireEnv, supabaseAdmin, supabaseForUser } from "./supabase-admin";

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
export function requireUser(req: Request): Promise<AuthedUser> {
  let pending = checked.get(req);
  if (!pending) {
    pending = authenticate(req);
    checked.set(req, pending);
  }
  return pending;
}

/** The answer of the sign-in check for each request, so a route that is rate limited asks Supabase once, not twice. */
const checked = new WeakMap<Request, Promise<AuthedUser>>();

async function authenticate(req: Request): Promise<AuthedUser> {
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

/**
 * Scheduled jobs call their route without a user token. They send the shared secret in the
 * `x-cron-secret` header (the same value as the `CRON_SECRET` environment variable); anything else is a 401.
 * The comparison takes the same time whatever the guess, and a missing `CRON_SECRET` is a deploy bug (500),
 * never an open route.
 */
export function requireCronSecret(req: Request): void {
  const expected = requireEnv("CRON_SECRET");
  const given = req.headers.get("x-cron-secret");
  if (!given) throw unauthorized("Missing cron secret");
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  if (!timingSafeEqual(a, b)) throw unauthorized("Wrong cron secret");
}

/** Deleting an account asks for a sign-in this recent (the contract says "requires a recent login"). */
export const RECENT_LOGIN_MINUTES = 15;

/** When the user last signed in, in seconds since 1970, from the claims of their access token; null if there is none. */
export function lastSignInSeconds(accessToken: string): number | null {
  const payload = accessToken.split(".")[1];
  if (!payload) return null;
  let claims: { iat?: unknown; amr?: unknown };
  try {
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  // `amr` lists how and when the session was signed in; it survives a refresh of the token, `iat` does not.
  const times = Array.isArray(claims.amr)
    ? claims.amr.map((a: { timestamp?: unknown }) => a?.timestamp).filter((t): t is number => typeof t === "number")
    : [];
  if (times.length > 0) return Math.max(...times);
  return typeof claims.iat === "number" ? claims.iat : null;
}

/**
 * A stolen or forgotten session must not be able to delete an account: the access token is already verified by
 * `requireUser`, and this asks that the user signed in within `RECENT_LOGIN_MINUTES`. Otherwise 403, and the app
 * asks for the password again and retries.
 */
export function requireRecentLogin(req: Request, now: Date = new Date()): void {
  const [scheme, token] = (req.headers.get("authorization") ?? "").split(" ");
  const at = scheme?.toLowerCase() === "bearer" && token ? lastSignInSeconds(token) : null;
  if (at === null || now.getTime() / 1000 - at > RECENT_LOGIN_MINUTES * 60) {
    throw forbidden("For your safety, sign in again to delete your account.");
  }
}
