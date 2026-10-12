"use client";

// packages/shared/src/hooks/db/prescriptions.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import type { DbError } from "../../db/queries/helpers";
import {
  createDoctorPrescription,
  getPrescription,
  listActiveItems,
  listPrescriptions,
  setItemActive,
  type CreateDoctorPrescriptionInput,
  type CreateDoctorPrescriptionResult,
  type PrescriptionWithItems,
} from "../../db/queries/prescriptions";
import type { DbPrescriptionItem } from "../../db/types";
import { QUERY_ROOTS } from "../api/query-roots";
import { DB_KEYS, useDb, useInvalidate } from "./shared";

/** The signed-in patient's prescriptions; a doctor passes `patientId`. */
export function usePrescriptions(patientId?: string) {
  const { sb, ready } = useDb();
  return useQuery<PrescriptionWithItems[], DbError>({
    queryKey: [QUERY_ROOTS.prescriptions, "list", patientId ?? "me"],
    queryFn: () => listPrescriptions(sb, patientId),
    enabled: ready,
  });
}

export function usePrescription(id: string | undefined) {
  const { sb, ready } = useDb();
  return useQuery<PrescriptionWithItems, DbError>({
    queryKey: [QUERY_ROOTS.prescriptions, "one", id],
    queryFn: () => getPrescription(sb, id as string),
    enabled: ready && !!id,
  });
}

export function useActiveItems() {
  const { sb, ready } = useDb();
  return useQuery<DbPrescriptionItem[], DbError>({
    queryKey: [QUERY_ROOTS.activeItems],
    queryFn: () => listActiveItems(sb),
    enabled: ready,
  });
}

/** A doctor writes an e-prescription. Its `condition_id` (when set) feeds `useGenerateCarePlan`. */
export function useCreateDoctorPrescription() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<CreateDoctorPrescriptionResult, DbError, CreateDoctorPrescriptionInput>({
    mutationFn: (input) => createDoctorPrescription(sb, input),
    onSuccess: () => invalidate(QUERY_ROOTS.prescriptions, QUERY_ROOTS.activeItems, QUERY_ROOTS.carePlans, DB_KEYS.conditions, DB_KEYS.timeline),
  });
}

/** Switches a medicine on or off. */
export function useSetItemActive() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbPrescriptionItem, DbError, { id: string; active: boolean }>({
    mutationFn: ({ id, active }) => setItemActive(sb, id, active),
    onSuccess: () => invalidate(QUERY_ROOTS.prescriptions, QUERY_ROOTS.activeItems),
  });
}
