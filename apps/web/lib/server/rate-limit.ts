import "server-only";
import { log } from "./log";
import { supabaseAdmin } from "./supabase-admin";

/** One limit: at most `max` calls per user in each window of `windowSeconds`, counted in the bucket named `bucket`. */
export interface RateLimit {
  bucket: string;
  windowSeconds: number;
  max: number;
}

export interface RateLimitVerdict {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window ends and the user may call again (at least 1). */
  retryAfterSeconds: number;
}

/** A broken counter must never keep a patient out, so the check gives up after this long and lets the request through. */
const CHECK_TIMEOUT_MS = 2000;

/** Mock runs (`LLM_MOCK=1`, `TINYFISH_MOCK=1`) cost nothing, so they are not counted: tests and the eval scripts stay under no limit. */
const isMockRun = () => process.env.LLM_MOCK === "1" || process.env.TINYFISH_MOCK === "1";

interface CounterRow {
  allowed: boolean;
  remaining: number;
  reset_at: string;
}

/**
 * Counts one call of `userId` in the database (`hit_rate_limit`, migration 0012) and says whether it is allowed.
 *
 * Returns `null` when there is no verdict: in a mock run, and when the check itself fails. The caller then lets the
 * request through ("fail open", logged): a broken counter must never block a patient. The service-role client is used
 * because only it may call the function, and it is called only after the user was identified.
 */
export async function checkRateLimit(userId: string, limit: RateLimit, now: Date = new Date()): Promise<RateLimitVerdict | null> {
  if (isMockRun()) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const call = supabaseAdmin().rpc("hit_rate_limit", {
      p_user: userId,
      p_bucket: limit.bucket,
      p_window_seconds: limit.windowSeconds,
      p_max: limit.max,
    });
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("rate limit check timed out")), CHECK_TIMEOUT_MS);
    });
    const { data, error } = await Promise.race([Promise.resolve(call), timeout]);
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as CounterRow | null | undefined;
    if (!row || typeof row.allowed !== "boolean" || typeof row.remaining !== "number" || Number.isNaN(Date.parse(row.reset_at))) {
      throw new Error("unexpected answer from hit_rate_limit");
    }
    const retryAfterSeconds = Math.max(1, Math.ceil((Date.parse(row.reset_at) - now.getTime()) / 1000));
    return { allowed: row.allowed, remaining: row.remaining, retryAfterSeconds };
  } catch (err) {
    log({ event: "rate_limit_check_failed", bucket: limit.bucket, error: err instanceof Error ? err.name : "Error" });
    return null;
  } finally {
    clearTimeout(timer);
  }
}
