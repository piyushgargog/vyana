// packages/shared/src/db/queries/waitlist.ts
// The plan waitlist (issue #301): an email, a plan and a short note — no patient data.
// Owner: Vaibhav Parmar

import { unwrap, type Sb } from "./helpers";

/**
 * Joins the waitlist for a plan. The database function is the only way in: it
 * checks the address, lower-cases it and rate limits joins. It answers only
 * whether the address is new to the plan (true) or was already on it (false) —
 * the stored row is never handed back, so submitting somebody else's address
 * cannot reveal their note or when they joined.
 */
export async function joinWaitlist(sb: Sb, email: string, planId: string, note?: string): Promise<boolean> {
  return unwrap(await sb.rpc("join_waitlist", { p_email: email, p_plan_id: planId, p_note: note })) as boolean;
}
