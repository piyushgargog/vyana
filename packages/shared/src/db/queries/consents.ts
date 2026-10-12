// packages/shared/src/db/queries/consents.ts
// DPDP consent at sign-up. Owner: Vaibhav Parmar

import type { DbConsent } from "../types";
import { check, requireUserId, unwrap, unwrapOrNull, type Sb } from "./helpers";

/** The signed-in user's record of accepting `version`, or null when they have not accepted it. */
export async function getConsent(sb: Sb, version: string): Promise<DbConsent | null> {
  const userId = await requireUserId(sb);
  return unwrapOrNull(await sb.from("consents").select("*").eq("user_id", userId).eq("version", version).maybeSingle());
}

/** Records the consent. Accepting the same version twice keeps the first record. */
export async function acceptConsent(sb: Sb, version: string): Promise<DbConsent> {
  const userId = await requireUserId(sb);
  check(await sb.from("consents").upsert({ user_id: userId, version }, { onConflict: "user_id,version", ignoreDuplicates: true }));
  return unwrap(await sb.from("consents").select("*").eq("user_id", userId).eq("version", version).single());
}
