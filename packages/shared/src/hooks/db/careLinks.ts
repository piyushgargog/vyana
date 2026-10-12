"use client";

// packages/shared/src/hooks/db/careLinks.ts
// Caregiver mode. Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import {
  acceptCareInvite,
  createCareInvite,
  listMyCaregivers,
  listMyPatients,
  revokeCareLink,
  type CaregiverLink,
  type PatientLink,
} from "../../db/queries/careLinks";
import type { DbError } from "../../db/queries/helpers";
import type { DbCareLink } from "../../db/types";
import { QUERY_ROOTS } from "../api/query-roots";
import { useDb, useInvalidate } from "./shared";

/** Creates a 6-digit code (valid for 24 hours) for a caregiver to enter. */
export function useCareInvite() {
  const { sb } = useDb();
  return useMutation<string, DbError, void>({
    mutationFn: () => createCareInvite(sb),
  });
}

/** The caregiver enters a code. The result is `null` for a wrong or expired code. */
export function useAcceptCareInvite() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbCareLink | null, DbError, { code: string; relation?: string }>({
    mutationFn: ({ code, relation }) => acceptCareInvite(sb, code, relation),
    onSuccess: () => invalidate(QUERY_ROOTS.careLinks),
  });
}

export function useMyCaregivers() {
  const { sb, ready } = useDb();
  return useQuery<CaregiverLink[], DbError>({
    queryKey: [QUERY_ROOTS.careLinks, "caregivers"],
    queryFn: () => listMyCaregivers(sb),
    enabled: ready,
  });
}

export function useMyPatients() {
  const { sb, ready } = useDb();
  return useQuery<PatientLink[], DbError>({
    queryKey: [QUERY_ROOTS.careLinks, "patients"],
    queryFn: () => listMyPatients(sb),
    enabled: ready,
  });
}

export function useRevokeCareLink() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbCareLink, DbError, string>({
    mutationFn: (id) => revokeCareLink(sb, id),
    onSuccess: () => invalidate(QUERY_ROOTS.careLinks),
  });
}
