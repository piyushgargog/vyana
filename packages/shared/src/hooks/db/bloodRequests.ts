"use client";

// packages/shared/src/hooks/db/bloodRequests.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery } from "@tanstack/react-query";

import type { DbError } from "../../db/queries/helpers";
import {
  createBloodRequest,
  listBloodRequests,
  updateBloodRequest,
  type CreateBloodRequestInput,
  type UpdateBloodRequestInput,
} from "../../db/queries/bloodRequests";
import type { DbBloodRequest } from "../../db/types";
import { DB_KEYS, useDb, useInvalidate } from "./shared";

/** The signed-in patient's blood requests, newest first. */
export function useBloodRequests() {
  const { sb, ready } = useDb();
  return useQuery<DbBloodRequest[], DbError>({
    queryKey: [DB_KEYS.bloodRequests],
    queryFn: () => listBloodRequests(sb),
    enabled: ready,
  });
}

export function useCreateBloodRequest() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbBloodRequest, DbError, CreateBloodRequestInput>({
    mutationFn: (input) => createBloodRequest(sb, input),
    onSuccess: () => invalidate(DB_KEYS.bloodRequests),
  });
}

export function useUpdateBloodRequest() {
  const { sb } = useDb();
  const invalidate = useInvalidate();
  return useMutation<DbBloodRequest, DbError, { id: string; patch: UpdateBloodRequestInput }>({
    mutationFn: ({ id, patch }) => updateBloodRequest(sb, id, patch),
    onSuccess: () => invalidate(DB_KEYS.bloodRequests),
  });
}
