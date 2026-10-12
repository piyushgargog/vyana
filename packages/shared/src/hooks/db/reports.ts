"use client";

// packages/shared/src/hooks/db/reports.ts
// Owner: Vaibhav Parmar

import { useQuery } from "@tanstack/react-query";

import type { DbError } from "../../db/queries/helpers";
import { getLabReport, listLabReports, listLabValueHistory, type LabReportWithValues } from "../../db/queries/reports";
import type { DbLabReport, DbLabValue } from "../../db/types";
import { QUERY_ROOTS } from "../api/query-roots";
import { useDb } from "./shared";

/** The signed-in patient's lab reports; a doctor or caregiver passes `patientId`. */
export function useLabReports(patientId?: string) {
  const { sb, ready } = useDb();
  return useQuery<DbLabReport[], DbError>({
    queryKey: [QUERY_ROOTS.labReports, "list", patientId ?? "me"],
    queryFn: () => listLabReports(sb, patientId),
    enabled: ready,
  });
}

export function useLabReport(id: string | undefined) {
  const { sb, ready } = useDb();
  return useQuery<LabReportWithValues, DbError>({
    queryKey: [QUERY_ROOTS.labReports, "one", id],
    queryFn: () => getLabReport(sb, id as string),
    enabled: ready && !!id,
  });
}

/** One test over time (for example 'HbA1c'), for the trend chart. */
export function useLabValueHistory(testName: string | undefined) {
  const { sb, ready } = useDb();
  return useQuery<DbLabValue[], DbError>({
    queryKey: [QUERY_ROOTS.labValues, testName],
    queryFn: () => listLabValueHistory(sb, testName as string),
    enabled: ready && !!testName,
  });
}
