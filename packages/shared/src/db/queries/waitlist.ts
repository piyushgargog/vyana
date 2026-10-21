// packages/shared/src/db/queries/waitlist.ts
// The plan waitlist (issue #301): an email, a plan and a short note — no patient data.
// Owner: Vaibhav Parmar

import { unwrap, type Sb } from "./helpers";

/** One waitlist row, as `join_waitlist` (migration 0016) hands it back. */
export interface WaitlistEntry {
  id: string;
  email: string;
  plan_id: string;
  note: string | null;
  created_at: string;
}

/**
 * Joins the waitlist for a plan. The database function is the only way in: it
 * checks the address, lower-cases it, rate limits joins, and hands back the
 * first row when the same address joins the same plan twice.
 */
export async function joinWaitlist(sb: Sb, email: string, planId: string, note?: string): Promise<WaitlistEntry> {
  const rows = unwrap(await sb.rpc("join_waitlist", { p_email: email, p_plan_id: planId, p_note: note })) as WaitlistEntry[];
  return rows[0];
}
