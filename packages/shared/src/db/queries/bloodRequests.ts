// packages/shared/src/db/queries/bloodRequests.ts
// The RapidBlood tracker (issue #235): the requests a patient is following, newest first.
// Owner: Vaibhav Parmar

import type { BloodComponent, BloodGroup, BloodRequestStatus } from "../../contracts";
import type { DbBloodRequest } from "../types";
import { DbError, requireUserId, unwrap, type Sb } from "./helpers";

/** The groups a request can ask for — the words of the v1.1 contracts (#246), typed from them so there is one source. */
export const BLOOD_GROUPS: readonly BloodGroup[] = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

/** The components of the v1.1 contracts (#246). */
export const BLOOD_COMPONENTS: readonly BloodComponent[] = ["whole_blood", "red_cells", "platelets", "plasma"];

/** Where a request stands, in the order it usually moves. `cancelled` can come from any step. */
export const BLOOD_REQUEST_STATUSES: readonly BloodRequestStatus[] = ["searching", "contacted", "confirmed", "arranged", "received", "cancelled"];

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
