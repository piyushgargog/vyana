import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { unauthorized } from "../errors";
import { requireEnv } from "../supabase-admin";

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
