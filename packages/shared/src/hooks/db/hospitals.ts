"use client";

// packages/shared/src/hooks/db/hospitals.ts
// Owner: Vaibhav Parmar

import { useQuery } from "@tanstack/react-query";

import type { DbError, Sb } from "../../db/queries/helpers";
import { getHospital, listDepartments, listHospitals, type HospitalFilter, type HospitalWithDepartments } from "../../db/queries/hospitals";
import type { DbDepartment, DbHospital } from "../../db/types";
import { QUERY_ROOTS } from "../api/query-roots";
import { useDb } from "./shared";

/**
 * Runs a hospitals read only after the client itself has loaded its session (#223).
 *
 * The React session state and the Supabase client's own session settle at different moments
 * right after sign-in. A hospitals query enabled by the state alone could reach the database
 * before the client attached the user's token — and because the hospitals and departments
 * tables are readable by signed-in users only, that read comes back as a successful empty
 * list, which the query cache then kept for minutes (the booking page showed "no hospitals"
 * until a full reload). Waiting for the client's session first closes that window: the read
 * carries the token, or does not run at all.
 */
async function afterSession<T>(sb: Sb, run: () => Promise<T>): Promise<T> {
  await sb.auth.getSession().catch(() => null);
  return run();
}

export function useHospitals(filter: HospitalFilter = {}) {
  const { sb, ready } = useDb();
  return useQuery<DbHospital[], DbError>({
    queryKey: [QUERY_ROOTS.hospitals, "list", filter],
    queryFn: () => afterSession(sb, () => listHospitals(sb, filter)),
    enabled: ready,
  });
}

/** One hospital with its departments. */
export function useHospital(id: string | undefined) {
  const { sb, ready } = useDb();
  return useQuery<HospitalWithDepartments, DbError>({
    queryKey: [QUERY_ROOTS.hospitals, "one", id],
    queryFn: () => afterSession(sb, () => getHospital(sb, id as string)),
    enabled: ready && !!id,
  });
}

export function useDepartments(hospitalId: string | undefined) {
  const { sb, ready } = useDb();
  return useQuery<DbDepartment[], DbError>({
    queryKey: [QUERY_ROOTS.hospitals, "departments", hospitalId],
    queryFn: () => afterSession(sb, () => listDepartments(sb, hospitalId as string)),
    enabled: ready && !!hospitalId,
  });
}
