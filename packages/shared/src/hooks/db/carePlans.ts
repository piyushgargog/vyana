"use client";

// packages/shared/src/hooks/db/carePlans.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import { approveCarePlan, getCarePlan, listCarePlans, type PlanJson } from "../../db/queries/carePlans";
import type { DbError } from "../../db/queries/helpers";
import type { DbCarePlan } from "../../db/types";
import { QUERY_ROOTS } from "../api/query-roots";
import { useDb, useInvalidate } from "./shared";

/** The newest care plan of a condition (a patient sees it once a doctor approved it). */
export function useCarePlan(conditionId: string | undefined) {
  const { sb, ready } = useDb();
  return useQuery<DbCarePlan | null, DbError>({
    queryKey: [QUERY_ROOTS.carePlans, "condition", conditionId],
    queryFn: () => getCarePlan(sb, conditionId as string),
    enabled: ready && !!conditionId,
  });
}

/** The signed-in patient's care plans; a doctor passes `patientId` to review drafts. */
export function useCarePlans(patientId?: string) {
  const { sb, ready } = useDb();
  return useQuery<DbCarePlan[], DbError>({
    queryKey: [QUERY_ROOTS.carePlans, "list", patientId ?? "me"],
    queryFn: () => listCarePlans(sb, patientId),
    enabled: ready,
  });
}

/** A doctor approves a plan with their edits. The patient sees it live (Realtime on care_plans). */
export function useApproveCarePlan() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbCarePlan, DbError, { id: string; plan: PlanJson }>({
    mutationFn: ({ id, plan }) => approveCarePlan(sb, id, plan),
    onSuccess: () => invalidate(QUERY_ROOTS.carePlans),
  });
}
