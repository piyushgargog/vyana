"use client";

// packages/shared/src/hooks/db/doctors.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getDoctor,
  getMyDoctorProfile,
  listVerifiedDoctors,
  upsertMyDoctorProfile,
  type DoctorFilter,
  type DoctorListing,
  type DoctorProfileInput,
} from "../../db/queries/doctors";
import type { DbError } from "../../db/queries/helpers";
import type { DbDoctor } from "../../db/types";
import { QUERY_ROOTS } from "../api/query-roots";
import { DB_KEYS, useDb } from "./shared";

/** Verified doctors with their names, optionally for one hospital, department or specialization. */
export function useDoctors(filter: DoctorFilter = {}) {
  const { sb, ready } = useDb();
  return useQuery<DoctorListing[], DbError>({
    queryKey: [QUERY_ROOTS.doctors, "list", filter],
    queryFn: () => listVerifiedDoctors(sb, filter),
    enabled: ready,
  });
}

export function useDoctor(id: string | undefined) {
  const { sb, ready } = useDb();
  return useQuery<DoctorListing | null, DbError>({
    queryKey: [QUERY_ROOTS.doctors, "one", id],
    queryFn: () => getDoctor(sb, id as string),
    enabled: ready && !!id,
  });
}

/** The signed-in doctor's own row with its verification status. */
export function useMyDoctorProfile() {
  const { sb, userId, ready } = useDb();
  return useQuery<DbDoctor | null, DbError>({
    queryKey: [QUERY_ROOTS.doctors, DB_KEYS.myDoctor, userId],
    queryFn: () => getMyDoctorProfile(sb),
    enabled: ready,
  });
}

export function useUpsertDoctorProfile() {
  const { sb } = useDb();
  const queryClient = useQueryClient();
  return useMutation<DbDoctor, DbError, DoctorProfileInput>({
    mutationFn: (data) => upsertMyDoctorProfile(sb, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.doctors] }),
  });
}
