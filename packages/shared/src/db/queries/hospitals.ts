// packages/shared/src/db/queries/hospitals.ts
// Owner: Vaibhav Parmar

import type { DbDepartment, DbHospital } from "../types";
import { unwrap, type Sb } from "./helpers";

export type HospitalFilter = {
  city?: string;
  kind?: "government" | "private";
  /** Only hospitals that have a department with this name (case-insensitive, partial match). */
  department?: string;
};

export type HospitalWithDepartments = DbHospital & { departments: DbDepartment[] };

export async function listHospitals(sb: Sb, filter: HospitalFilter = {}): Promise<DbHospital[]> {
  // `departments!inner` keeps only hospitals with a matching department
  const base = filter.department ? sb.from("hospitals").select("*, departments!inner(id)") : sb.from("hospitals").select("*");
  let query = base.order("name");
  if (filter.city) query = query.eq("city", filter.city);
  if (filter.kind) query = query.eq("kind", filter.kind);
  if (filter.department) query = query.ilike("departments.name", `%${filter.department}%`);
  const rows = unwrap(await query) as (DbHospital & { departments?: unknown })[];
  return rows.map(({ departments: _departments, ...hospital }) => hospital);
}

export async function getHospital(sb: Sb, id: string): Promise<HospitalWithDepartments> {
  return unwrap(await sb.from("hospitals").select("*, departments(*)").eq("id", id).order("name", { referencedTable: "departments" }).single());
}

export async function listDepartments(sb: Sb, hospitalId: string): Promise<DbDepartment[]> {
  return unwrap(await sb.from("departments").select("*").eq("hospital_id", hospitalId).order("name"));
}
