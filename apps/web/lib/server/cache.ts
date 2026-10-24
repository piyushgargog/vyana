import "server-only";
import { createHash } from "node:crypto";
import { normalizeName } from "@vyana/shared";
import { log } from "./log";
import { supabaseAdmin } from "./supabase-admin";

/**
 * Postgres cache for public web data (DESIGN §5). Only public results (prices, hospitals, NMC records,
 * search results) go in here, never patient data, so every user can share an entry.
 */

export const TTL = {
  quarter: 15 * 60,
  hour: 60 * 60,
  day: 24 * 60 * 60,
} as const;

const inFlight = new Map<string, Promise<{ value: unknown; cached: boolean } | null>>();

/** Lowercase, trim and collapse spaces, so the same input typed differently lands on one key. */
export function normalizeKeyPart(s: string): string {
  return normalizeName(s);
}

export function sha1(s: string): string {
  return createHash("sha1").update(s).digest("hex");
}

async function readCache<T>(key: string): Promise<T | null> {
  const { data, error } = await supabaseAdmin()
    .from("web_cache")
    .select("payload")
    .eq("key", key)
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  if (error) {
    // A broken cache must never break the feature: treat it as a miss.
    log({ event: "cache_read_failed", kind: "web_cache" });
    return null;
  }
  return (data?.payload as T | undefined) ?? null;
}

async function writeCache(key: string, kind: string, ttlSeconds: number, payload: unknown): Promise<void> {
  const now = Date.now();
  const { error } = await supabaseAdmin()
    .from("web_cache")
    .upsert({
      key,
      kind,
      payload,
      fetched_at: new Date(now).toISOString(),
      expires_at: new Date(now + ttlSeconds * 1000).toISOString(),
    });
  if (error) log({ event: "cache_write_failed", kind });
}

/**
 * Returns the cached value for `key`, or runs `compute()` and stores its result.
 * - A `null` result is returned as `null` and never stored.
 * - Identical requests running at the same time share one `compute()` (saves agent credits).
 */
export async function cached<T>(
  key: string,
  kind: string,
  ttlSeconds: number,
  compute: () => Promise<T | null>,
): Promise<{ value: T; cached: boolean } | null> {
  const pending = inFlight.get(key);
  if (pending) return pending as Promise<{ value: T; cached: boolean } | null>;

  const run = (async () => {
    const hit = await readCache<T>(key);
    if (hit !== null) return { value: hit, cached: true };
    const value = await compute();
    if (value === null) return null;
    await writeCache(key, kind, ttlSeconds, value);
    return { value, cached: false };
  })();

  inFlight.set(key, run);
  try {
    return await run;
  } finally {
    inFlight.delete(key);
  }
}
