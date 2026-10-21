// packages/shared/src/db/queries/bloodRequests.ts
// The RapidBlood tracker (issue #235): the requests a patient is following, newest first.
// Owner: Vaibhav Parmar

import type { DbBloodRequest } from "../types";
import { DbError, requireUserId, unwrap, type Sb } from "./helpers";

/** The words of the v1.1 contracts (#233): the groups a request can ask for. */
export const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"] as const;
export type BloodGroup = (typeof BLOOD_GROUPS)[number];

/** The components of the v1.1 contracts (#233). */
export const BLOOD_COMPONENTS = ["whole_blood", "red_cells", "platelets", "plasma"] as const;
export type BloodComponent = (typeof BLOOD_COMPONENTS)[number];

/** Where a request stands, in the order it usually moves. `cancelled` can come from any step. */
export const BLOOD_REQUEST_STATUSES = ["searching", "contacted", "confirmed", "arranged", "received", "cancelled"] as const;
export type BloodRequestStatus = (typeof BLOOD_REQUEST_STATUSES)[number];

/** A request is for at most this many units (the same cap as the table's check, migration 0013). */
export const BLOOD_REQUEST_MAX_UNITS = 10;

export type CreateBloodRequestInput = {
  blood_group: BloodGroup;
  component: BloodComponent;
  units: number;
  hospital_name: string;
  city: string;
  contact_name: string;
  contact_phone: string;
  note?: string | null;
};

/** The fields of a request its owner may change later (never who it belongs to). */
export type UpdateBloodRequestInput = Partial<
  Pick<DbBloodRequest, "blood_group" | "component" | "units" | "hospital_name" | "city" | "contact_name" | "contact_phone" | "status" | "note">
>;

function checkUnits(units: number): void {
  if (!Number.isInteger(units) || units < 1 || units > BLOOD_REQUEST_MAX_UNITS) {
    throw new DbError(`A blood request is for 1 to ${BLOOD_REQUEST_MAX_UNITS} units`, "invalid_units");
  }
}

/** The signed-in patient's requests, newest first. */
export async function listBloodRequests(sb: Sb): Promise<DbBloodRequest[]> {
  const patientId = await requireUserId(sb);
  return unwrap(await sb.from("blood_requests").select("*").eq("patient_id", patientId).order("created_at", { ascending: false }));
}

/** Starts a request in the "searching" state (the table's default). */
export async function createBloodRequest(sb: Sb, input: CreateBloodRequestInput): Promise<DbBloodRequest> {
  checkUnits(input.units);
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("blood_requests")
      .insert({
        patient_id: patientId,
        blood_group: input.blood_group,
        component: input.component,
        units: input.units,
        hospital_name: input.hospital_name,
        city: input.city,
        contact_name: input.contact_name,
        contact_phone: input.contact_phone,
        note: input.note ?? null,
      })
      .select()
      .single()
  );
}

/**
 * Changes a request of the signed-in patient (usually its status, as the follow-up moves).
 * A request that is not the patient's (or does not exist) changes no row, and that is an error:
 * the database would otherwise answer "ok" and the app would say the change was saved.
 */
export async function updateBloodRequest(sb: Sb, id: string, patch: UpdateBloodRequestInput): Promise<DbBloodRequest> {
  if (patch.units !== undefined) checkUnits(patch.units);
  const patientId = await requireUserId(sb);
  const rows = unwrap(await sb.from("blood_requests").update(patch).eq("id", id).eq("patient_id", patientId).select());
  if (rows.length === 0) throw new DbError("That blood request was not found", "not_found");
  return rows[0];
}
