// packages/shared/src/db/queries/prescriptions.ts
// Owner: Vaibhav Parmar

import { DEFAULT_TIMES, type FrequencyType } from "../../constants";
import type { TablesInsert } from "../database.types";
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
   * The condition created from the diagnosis (so the web can call useGenerateCarePlan), or null when
   * there is none yet. A doctor cannot insert conditions; a database trigger on prescriptions does (V12).
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
 * A doctor writes an e-prescription for one of their patients. The prescription row is inserted first,
 * then all its medicines in one statement. RLS only lets a doctor prescribe, in their own name, for a
 * patient of their department.
 */
export async function createDoctorPrescription(sb: Sb, input: CreateDoctorPrescriptionInput): Promise<CreateDoctorPrescriptionResult> {
  const items = prepareDoctorItems(input.items);
  const doctorId = await requireUserId(sb);

  const prescription = unwrap(
    await sb
      .from("prescriptions")
      .insert({
        patient_id: input.patient_id,
        doctor_id: doctorId,
        appointment_id: input.appointment_id ?? null,
        source: "doctor",
        diagnosis: input.diagnosis,
        notes: input.notes ?? null,
      })
      .select()
      .single()
  );

  const saved = unwrap(
    await sb
      .from("prescription_items")
      .insert(items.map((item) => ({ ...item, prescription_id: prescription.id, patient_id: input.patient_id })))
      .select()
  );

  const condition = unwrapOrNull(await sb.from("conditions").select("id").eq("prescription_id", prescription.id).limit(1).maybeSingle());
  return { prescription, items: saved, condition_id: condition?.id ?? null };
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
