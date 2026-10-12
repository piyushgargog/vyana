"use client";

// packages/shared/src/hooks/db/alerts.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import { listDrugAlerts, markAlertSeen } from "../../db/queries/alerts";
import type { DbError } from "../../db/queries/helpers";
import type { DbDrugAlert } from "../../db/types";
import { QUERY_ROOTS } from "../api/query-roots";
import { useDb, useInvalidate } from "./shared";

export function useDrugAlerts() {
  const { sb, ready } = useDb();
  return useQuery<DbDrugAlert[], DbError>({
    queryKey: [QUERY_ROOTS.drugAlerts],
    queryFn: () => listDrugAlerts(sb),
    enabled: ready,
  });
}

export function useMarkAlertSeen() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbDrugAlert, DbError, string>({
    mutationFn: (id) => markAlertSeen(sb, id),
    onSuccess: () => invalidate(QUERY_ROOTS.drugAlerts),
  });
}
