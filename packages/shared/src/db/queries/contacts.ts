// packages/shared/src/db/queries/contacts.ts
// Owner: Vaibhav Parmar

import type { TablesInsert } from "../database.types";
import type { DbEmergencyContact } from "../types";
import { check, requireUserId, unwrap, type Sb } from "./helpers";

export type EmergencyContactInput = Pick<TablesInsert<"emergency_contacts">, "name" | "phone" | "relation">;

export async function listEmergencyContacts(sb: Sb): Promise<DbEmergencyContact[]> {
  const patientId = await requireUserId(sb);
  return unwrap(await sb.from("emergency_contacts").select("*").eq("patient_id", patientId).order("created_at"));
}

export async function addEmergencyContact(sb: Sb, input: EmergencyContactInput): Promise<DbEmergencyContact> {
  const patientId = await requireUserId(sb);
  return unwrap(await sb.from("emergency_contacts").insert({ ...input, patient_id: patientId }).select().single());
}

export async function deleteEmergencyContact(sb: Sb, id: string): Promise<void> {
  check(await sb.from("emergency_contacts").delete().eq("id", id));
}
