// packages/shared/src/db/queries/prescriptions.ts
// Owner: Vaibhav Parmar

import { DEFAULT_TIMES, type FrequencyType } from "../../constants";
import type { Json, TablesInsert } from "../database.types";
import type { DbPrescription, DbPrescriptionItem } from "../types";
import { DbError, requireUserId, toLocalDate, unwrap, unwrapOrNull, type Sb } from "./helpers";

export type PrescriptionWithItems = DbPrescription & { prescription_items: DbPrescriptionItem[] };

/** One medicine on a prescription the doctor writes. The server fills prescription_id and patient_id. */
export type DoctorPrescriptionItem = Omit<TablesInsert<"prescription_items">, "prescription_id" | "patient_id" | "id" | "created_at">;

export type CreateDoctorPrescriptionInput = {
  patient_id: string;
  appointment_id?: string | null;
  diagnosis: string;
  notes?: string | null;
  items: DoctorPrescriptionItem[];
};

export type CreateDoctorPrescriptionResult = {
  prescription: DbPrescription;
  items: DbPrescriptionItem[];
  /**
   * The condition that the diagnosis created (so the web can call `POST /api/care-plan` with it), or null
   * when the diagnosis was blank. A doctor cannot insert conditions; a trigger on prescriptions does it in the
   * same transaction (`0006_diagnosis_condition.sql`), so it already exists when the call returns.
   */
  condition_id: string | null;
};

const TIME_FORMAT = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Checks the medicines of an e-prescription before anything is written, and fills in the reminder
 * times of the frequency (`DEFAULT_TIMES`) when the doctor gave none. A prescription saved without
 * its medicines cannot be undone by a doctor, so a bad item must stop the whole call first.
 */
export function prepareDoctorItems(items: DoctorPrescriptionItem[]): DoctorPrescriptionItem[] {
  if (items.length === 0) throw new DbError("A prescription needs at least one medicine", "invalid_prescription");
  return items.map((item, i) => {
    const label = `Medicine ${i + 1}`;
    const fail = (why: string) => new DbError(`${label}: ${why}`, "invalid_prescription");
    if (!item.medicine_name || item.medicine_name.trim() === "") throw fail("the name is missing");
    if (!(item.frequency in DEFAULT_TIMES)) throw fail(`unknown frequency "${item.frequency}"`);
    const times = item.times && item.times.length > 0 ? item.times : DEFAULT_TIMES[item.frequency as FrequencyType];
    for (const t of times) if (!TIME_FORMAT.test(t)) throw fail(`"${t}" is not a time like 09:00`);
    if (item.quantity_total != null && item.quantity_total <= 0) throw fail("the quantity must be more than 0");
    if (item.refill_alert_days != null && item.refill_alert_days < 0) throw fail("refill_alert_days cannot be negative");
    return { ...item, medicine_name: item.medicine_name.trim(), times };
  });
}

/** The signed-in patient's prescriptions with their medicines, newest first. A doctor passes `patientId`. */
export async function listPrescriptions(sb: Sb, patientId?: string): Promise<PrescriptionWithItems[]> {
  const query = sb.from("prescriptions").select("*, prescription_items(*)").order("issued_on", { ascending: false }).order("created_at", { ascending: false });
  const res = await (patientId ? query.eq("patient_id", patientId) : query.eq("patient_id", await requireUserId(sb)));
  return unwrap(res);
}

export async function getPrescription(sb: Sb, id: string): Promise<PrescriptionWithItems> {
  return unwrap(await sb.from("prescriptions").select("*, prescription_items(*)").eq("id", id).single());
}

/**
 * A doctor writes an e-prescription for one of their patients. The prescription and all its medicines
 * are saved by the `create_doctor_prescription` function in ONE transaction: if a medicine is refused,
 * nothing is saved. (A doctor cannot delete a prescription, so a half-saved one could never be undone.)
 * Row level security still decides: a doctor can only prescribe, in their own name, for a patient of
 * their verified department. The medicines are also checked here first (`prepareDoctorItems`) so the
 * doctor gets a clear message.
 */
export async function createDoctorPrescription(sb: Sb, input: CreateDoctorPrescriptionInput): Promise<CreateDoctorPrescriptionResult> {
  const items = prepareDoctorItems(input.items);

  // The generated argument types are not nullable; the SQL function accepts null for both.
  const prescriptionId = unwrap(
    await sb.rpc("create_doctor_prescription", {
      p_patient: input.patient_id,
      p_appointment: (input.appointment_id ?? null) as string,
      p_diagnosis: input.diagnosis,
      p_notes: (input.notes ?? null) as string,
      p_items: items as unknown as Json,
    })
  );

  const saved = await getPrescription(sb, prescriptionId);
  const { prescription_items: savedItems, ...prescription } = saved;
  const condition = unwrapOrNull(await sb.from("conditions").select("id").eq("prescription_id", prescriptionId).limit(1).maybeSingle());
  return { prescription, items: savedItems, condition_id: condition?.id ?? null };
}

/** Switches a medicine on or off (the patient may do this even on a doctor's prescription). */
export async function setItemActive(sb: Sb, id: string, active: boolean): Promise<DbPrescriptionItem> {
  return unwrap(await sb.from("prescription_items").update({ active }).eq("id", id).select().single());
}

/** The signed-in patient's medicines that are switched on and not past their end date (`today` is a local `YYYY-MM-DD`). */
export async function listActiveItems(sb: Sb, today: string = toLocalDate(new Date())): Promise<DbPrescriptionItem[]> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("prescription_items")
      .select("*")
      .eq("patient_id", patientId)
      .eq("active", true)
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order("medicine_name")
  );
}
