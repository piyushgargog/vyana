// packages/shared/src/db/queries/doctors.ts
// Owner: Vaibhav Parmar

import type { Json, TablesInsert } from "../database.types";
import type { DbDoctor } from "../types";
import { requireUserId, unwrap, unwrapOrNull, type Sb } from "./helpers";

/** A verified doctor as a patient sees them: public fields and the name, no verification evidence. */
export type DoctorListing = {
  id: string;
  full_name: string | null;
  specialization: string;
  reg_no: string;
  state_council: string;
  year_of_registration: number | null;
  clinic_name: string | null;
  clinic_address: string | null;
  consultation_fee: number | null;
  availability: Json;
  hospital_id: string | null;
  department_id: string | null;
  verified_at: string | null;
};

export type DoctorFilter = { hospital_id?: string; department_id?: string; specialization?: string };

export type DoctorAvailability = { days: number[]; start: string; end: string; slot_minutes: number };

/** What a doctor may edit about themselves. Verification, hospital and department are set by the server. */
export type DoctorProfileInput = Pick<
  TablesInsert<"doctors">,
  "specialization" | "reg_no" | "state_council" | "year_of_registration" | "clinic_name" | "clinic_address" | "consultation_fee" | "availability"
>;

/** Verified doctors with their names (via `doctor_directory`). `specialization` matches part of the text, ignoring case. */
export async function listVerifiedDoctors(sb: Sb, filter: DoctorFilter = {}): Promise<DoctorListing[]> {
  const rows = unwrap(
    await sb.rpc("doctor_directory", { p_hospital: filter.hospital_id, p_department: filter.department_id })
  ) as DoctorListing[];
  const wanted = filter.specialization?.trim().toLowerCase();
  return wanted ? rows.filter((d) => d.specialization.toLowerCase().includes(wanted)) : rows;
}

export async function getDoctor(sb: Sb, id: string): Promise<DoctorListing | null> {
  const rows = unwrap(await sb.rpc("doctor_directory", { p_id: id })) as DoctorListing[];
  return rows[0] ?? null;
}

/** A doctor creates or edits their own profile row. A new row starts as 'pending' until the NMC check. */
export async function upsertMyDoctorProfile(sb: Sb, data: DoctorProfileInput): Promise<DbDoctor> {
  const id = await requireUserId(sb);
  return unwrap(await sb.from("doctors").upsert({ ...data, id }, { onConflict: "id" }).select().single());
}

/** The signed-in doctor's own row, with its verification status. */
export async function getMyDoctorProfile(sb: Sb): Promise<DbDoctor | null> {
  const id = await requireUserId(sb);
  return unwrapOrNull(await sb.from("doctors").select("*").eq("id", id).maybeSingle());
}

/** Every doctor whatever their status, with their name. Admin only: RLS hides the rest for others. */
export async function listAllDoctors(sb: Sb): Promise<(DbDoctor & { profile: { full_name: string | null } | null })[]> {
  return unwrap(await sb.from("doctors").select("*, profile:profiles!doctors_id_fkey(full_name)").order("created_at", { ascending: false }));
}

/** `HH:MM` slot starts of one day: from the doctor's availability, minus the times already booked. */
export function computeFreeSlots(availability: DoctorAvailability, date: string, bookedTimes: string[]): string[] {
  const [y, m, d] = date.split("-").map(Number);
  const isoDay = ((new Date(y, m - 1, d).getDay() + 6) % 7) + 1; // 1 = Monday ... 7 = Sunday
  if (!availability.days.includes(isoDay) || availability.slot_minutes <= 0) return [];
  const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const toText = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const booked = new Set(bookedTimes);
  const slots: string[] = [];
  for (let t = toMinutes(availability.start); t + availability.slot_minutes <= toMinutes(availability.end); t += availability.slot_minutes) {
    const text = toText(t);
    if (!booked.has(text)) slots.push(text);
  }
  return slots;
}

/**
 * Free start times of a doctor on `date` (`YYYY-MM-DD`). Booking is by token now, so most
 * appointments carry no time; only those with a `scheduled_at` that the caller can see are removed.
 */
export async function getFreeSlots(sb: Sb, doctorId: string, date: string): Promise<string[]> {
  const doctor = await getDoctor(sb, doctorId);
  if (!doctor) return [];
  const availability = doctor.availability as unknown as DoctorAvailability;
  const rows = unwrap(
    await sb.from("appointments").select("scheduled_at").eq("doctor_id", doctorId).eq("appointment_date", date).neq("status", "cancelled").not("scheduled_at", "is", null)
  );
  const booked = rows.map((r) => {
    const t = new Date(r.scheduled_at as string);
    return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
  });
  return computeFreeSlots(availability, date, booked);
}
