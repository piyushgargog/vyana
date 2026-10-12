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
