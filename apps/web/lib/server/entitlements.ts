import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError, rateLimited } from "./errors";
import { log } from "./log";

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Seconds from `now` until the next 00:00 in Asia/Kolkata (UTC+5:30, no daylight saving), at least 1. */
export function secondsUntilIstMidnight(now: Date = new Date()): number {
  const ist = now.getTime() + IST_OFFSET_MS;
  const msIntoDay = ((ist % DAY_MS) + DAY_MS) % DAY_MS;
  return Math.max(1, Math.ceil((DAY_MS - msIntoDay) / 1000));
}

const firstRow = (data: unknown): Record<string, unknown> | null => {
  const row = Array.isArray(data) ? data[0] : data;
  return row && typeof row === "object" ? (row as Record<string, unknown>) : null;
};

/** Answered when the plan or usage lookup fails: by decision the check fails closed (429), it never lets the call through. */
const checkFailed = () =>
  new AppError("RATE_LIMITED", "The daily AI limit could not be checked right now. Please try again in a little while.", 429, {
    "retry-after": "60",
  });

/**
 * Throws the usual 429 when the signed-in person has used today's AI calls of their plan. A plan whose `daily_ai_calls`
 * is null has no limit and passes. If the plan or usage lookup fails or is missing, it fails closed with a 429.
 */
export async function checkDailyAiLimit(sb: SupabaseClient, now: Date = new Date()): Promise<void> {
  let limit: number | null;
  let calls: number;
  try {
    const [plan, usage] = await Promise.all([sb.rpc("current_plan"), sb.rpc("my_ai_usage_today")]);
    if (plan.error || usage.error) throw new Error("plan lookup failed");
    const p = firstRow(plan.data);
    const u = firstRow(usage.data);
    if (!p || !("daily_ai_calls" in p) || (p.daily_ai_calls !== null && typeof p.daily_ai_calls !== "number")) throw new Error("no plan");
    if (!u || typeof u.calls !== "number") throw new Error("no usage");
    limit = p.daily_ai_calls as number | null;
    calls = u.calls;
  } catch {
    log({ event: "plan_check_failed" });
    throw checkFailed();
  }
  if (limit !== null && calls >= limit) throw rateLimited(secondsUntilIstMidnight(now));
}

/** The daily limit is a patient plan rule: doctors and admins are neither limited nor counted. Call after the role check. */
export async function enforceDailyAiLimit(authed: { profile: { role: string }; sb: SupabaseClient }, now: Date = new Date()): Promise<void> {
  if (authed.profile.role !== "patient") return;
  await checkDailyAiLimit(authed.sb, now);
}
