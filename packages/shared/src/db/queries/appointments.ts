// packages/shared/src/db/queries/appointments.ts
// Token booking like the government ORS portal (plan 7.5). Owner: Vaibhav Parmar

import type { DbAppointment, DbDepartment, DbHospital } from "../types";
import { requireUserId, unwrap, type Sb } from "./helpers";

export type AppointmentStatus = "requested" | "confirmed" | "completed" | "cancelled";

export type BookAppointmentInput = {
  hospital_id: string;
  department_id: string;
  /** A verified doctor of that department, or leave out to book the department's OPD queue. */
  doctor_id?: string | null;
  /** `YYYY-MM-DD` */
  appointment_date: string;
  reason?: string | null;
};

export type MyAppointment = DbAppointment & {
  hospitals: Pick<DbHospital, "name" | "address"> | null;
  departments: Pick<DbDepartment, "name"> | null;
};

export type QueueEntry = DbAppointment & {
  patient: { full_name: string | null } | null;
};

/**
 * Books a token through the `book_appointment` function (the only way to create an appointment).
 * It raises 'OPD is closed on that day', 'no tokens left for that day', 'date is in the past',
 * 'doctor is not in this department' and 'you already have a token for this department on that day'
 * (one active token per patient, department and day; cancelling frees it) as a DbError.
 */
export async function bookAppointment(sb: Sb, input: BookAppointmentInput): Promise<DbAppointment> {
  // The generated argument types are not nullable; the SQL function accepts null for both.
  return unwrap(
    await sb.rpc("book_appointment", {
      p_hospital: input.hospital_id,
      p_department: input.department_id,
      p_doctor: (input.doctor_id ?? null) as string,
      p_date: input.appointment_date,
      p_reason: (input.reason ?? null) as string,
    })
  ) as DbAppointment;
}

/** The signed-in patient's appointments, newest first, with the hospital and department names. */
export async function listMyAppointments(sb: Sb): Promise<MyAppointment[]> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb
      .from("appointments")
      .select("*, hospitals(name, address), departments(name)")
      .eq("patient_id", patientId)
      .order("appointment_date", { ascending: false })
      .order("token_no", { ascending: false })
  );
}

/**
 * A doctor's queue for one day (`YYYY-MM-DD`): their own bookings and their department's, in token order.
 * There is no filter by doctor: row level security decides which appointments a doctor may read.
 */
export async function listDoctorQueue(sb: Sb, date: string): Promise<QueueEntry[]> {
  return unwrap(
    await sb
      .from("appointments")
      .select("*, patient:profiles!appointments_patient_id_fkey(full_name)")
      .eq("appointment_date", date)
      .neq("status", "cancelled")
      .order("token_no")
  );
}

/** A doctor confirms or completes an appointment (with notes); a patient cancels their own. */
export async function updateAppointmentStatus(sb: Sb, id: string, status: AppointmentStatus, doctorNotes?: string): Promise<DbAppointment> {
  const patch = doctorNotes === undefined ? { status } : { status, doctor_notes: doctorNotes };
  return unwrap(await sb.from("appointments").update(patch).eq("id", id).select().single());
}

export type TokensLeft = { opd_open: boolean; tokens_left: number; daily_token_limit: number };

/**
 * Whether a department's OPD is open on `date` (`YYYY-MM-DD`) and how many tokens are left. It is a
 * count from `department_tokens()`: a patient cannot read other patients' appointments. Null for an unknown department.
 */
export async function getTokensLeft(sb: Sb, departmentId: string, date: string): Promise<TokensLeft | null> {
  const rows = unwrap(await sb.rpc("department_tokens", { p_department: departmentId, p_date: date })) as TokensLeft[];
  return rows[0] ?? null;
}
