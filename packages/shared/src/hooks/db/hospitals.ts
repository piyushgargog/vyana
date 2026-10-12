"use client";

// packages/shared/src/hooks/db/hospitals.ts
// Owner: Vaibhav Parmar

import { useQuery } from "@tanstack/react-query";

import type { DbError } from "../../db/queries/helpers";
import { getHospital, listDepartments, listHospitals, type HospitalFilter, type HospitalWithDepartments } from "../../db/queries/hospitals";
import type { DbDepartment, DbHospital } from "../../db/types";
import { QUERY_ROOTS } from "../api/query-roots";
import { useDb } from "./shared";

export function useHospitals(filter: HospitalFilter = {}) {
  const { sb, ready } = useDb();
  return useQuery<DbHospital[], DbError>({
    queryKey: [QUERY_ROOTS.hospitals, "list", filter],
    queryFn: () => listHospitals(sb, filter),
    enabled: ready,
  });
}

/** One hospital with its departments. */
export function useHospital(id: string | undefined) {
  const { sb, ready } = useDb();
  return useQuery<HospitalWithDepartments, DbError>({
    queryKey: [QUERY_ROOTS.hospitals, "one", id],
    queryFn: () => getHospital(sb, id as string),
    enabled: ready && !!id,
  });
}

export function useDepartments(hospitalId: string | undefined) {
  const { sb, ready } = useDb();
  return useQuery<DbDepartment[], DbError>({
    queryKey: [QUERY_ROOTS.hospitals, "departments", hospitalId],
    queryFn: () => listDepartments(sb, hospitalId as string),
    enabled: ready && !!hospitalId,
  });
}
