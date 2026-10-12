// packages/shared/src/db/queries/helpers.ts
// Shared plumbing for the direct-DB query functions (plan 7.2): the client type, error handling and
// the signed-in user id. Owner: Vaibhav Parmar

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../database.types";

/** Every query function takes the Supabase client as its first argument. */
export type Sb = SupabaseClient<Database>;

/** Thrown by every query function. `code` is the Postgres / PostgREST error code, e.g. 42501 (RLS) or 23505 (duplicate). */
export class DbError extends Error {
  readonly code: string | undefined;
  readonly details: string | undefined;
  constructor(message: string, code?: string, details?: string) {
    super(message);
    this.name = "DbError";
    this.code = code;
    this.details = details;
  }
}

function toDbError(error: Pick<PostgrestError, "message" | "code" | "details">): DbError {
  return new DbError(error.message, error.code, error.details);
}

/** Returns `data` or throws a DbError. Use for queries that must return something. */
export function unwrap<T>(res: { data: T; error: Pick<PostgrestError, "message" | "code" | "details"> | null }): NonNullable<T> {
  if (res.error) throw toDbError(res.error);
  if (res.data === null || res.data === undefined) throw new DbError("No data returned");
  return res.data as NonNullable<T>;
}

/** Like `unwrap`, but a missing row is `null` instead of an error. */
export function unwrapOrNull<T>(res: { data: T; error: Pick<PostgrestError, "message" | "code" | "details"> | null }): NonNullable<T> | null {
  if (res.error) throw toDbError(res.error);
  return (res.data ?? null) as NonNullable<T> | null;
}

/** Throws when a query that returns no rows failed. */
export function check(res: { error: Pick<PostgrestError, "message" | "code" | "details"> | null }): void {
  if (res.error) throw toDbError(res.error);
}

/** The id of the signed-in user, read from the local session (no network call). */
export async function requireUserId(sb: Sb): Promise<string> {
  const { data, error } = await sb.auth.getSession();
  if (error) throw new DbError(error.message, error.code);
  const id = data.session?.user.id;
  if (!id) throw new DbError("Not signed in", "not_signed_in");
  return id;
}

/** `YYYY-MM-DD` for a Date, in local time (the day a person sees on their phone). */
export function toLocalDate(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Start of a local calendar day as an ISO timestamp. `date` is `YYYY-MM-DD`. */
export function startOfLocalDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
}

/** Start of the next local calendar day as an ISO timestamp. */
export function startOfNextLocalDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d + 1, 0, 0, 0, 0).toISOString();
}

/** ISO timestamp for `days` days before now. */
export function daysAgoIso(days: number, now: Date = new Date()): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}
