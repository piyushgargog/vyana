// packages/shared/src/db/queries/prescriptions.ts
// Owner: Vaibhav Parmar

import type { TablesInsert } from "../database.types";
import type { DbPrescription, DbPrescriptionItem } from "../types";
import { requireUserId, toLocalDate, unwrap, unwrapOrNull, type Sb } from "./helpers";

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
  if (input.items.length === 0) throw new Error("A prescription needs at least one medicine");
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

  const items = unwrap(
    await sb
      .from("prescription_items")
      .insert(input.items.map((item) => ({ ...item, prescription_id: prescription.id, patient_id: input.patient_id })))
      .select()
  );

  const condition = unwrapOrNull(await sb.from("conditions").select("id").eq("prescription_id", prescription.id).limit(1).maybeSingle());
  return { prescription, items, condition_id: condition?.id ?? null };
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
