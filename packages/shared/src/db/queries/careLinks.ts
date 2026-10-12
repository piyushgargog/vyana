// packages/shared/src/db/queries/careLinks.ts
// Caregiver mode. Owner: Vaibhav Parmar

import type { DbCareLink } from "../types";
import { requireUserId, unwrap, unwrapOrNull, type Sb } from "./helpers";

export type CaregiverLink = DbCareLink & { caregiver: { id: string; full_name: string | null } | null };
export type PatientLink = DbCareLink & { patient: { id: string; full_name: string | null } | null };

/** A 6-digit code, valid for 24 hours, that the caregiver enters on their phone. */
export async function createCareInvite(sb: Sb): Promise<string> {
  return unwrap(await sb.rpc("create_care_invite"));
}

/**
 * The caregiver enters the code. Returns the new link, or `null` for a wrong or expired code (show
 * "invalid or expired code"). After 5 wrong codes in 15 minutes it throws 'too many attempts'.
 */
export async function acceptCareInvite(sb: Sb, code: string, relation?: string): Promise<DbCareLink | null> {
  const row = unwrapOrNull(await sb.rpc("accept_care_invite", { p_code: code, p_relation: relation }));
  return row && row.id ? (row as DbCareLink) : null;
}

/** The people who look after the signed-in patient (revoked ones included). */
export async function listMyCaregivers(sb: Sb): Promise<CaregiverLink[]> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("care_links")
      .select("*, caregiver:profiles!care_links_caregiver_id_fkey(id, full_name)")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false })
  );
}

/** The patients the signed-in caregiver looks after (active links only). */
export async function listMyPatients(sb: Sb): Promise<PatientLink[]> {
  const caregiverId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("care_links")
      .select("*, patient:profiles!care_links_patient_id_fkey(id, full_name)")
      .eq("caregiver_id", caregiverId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
  );
}

/** The patient switches a caregiver off. They cannot switch themselves back on. */
export async function revokeCareLink(sb: Sb, id: string): Promise<DbCareLink> {
  return unwrap(await sb.from("care_links").update({ status: "revoked" }).eq("id", id).select().single());
}
