"use client";

// packages/shared/src/hooks/db/emergency.ts
// Owner: Vaibhav Parmar

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";

import { getEmergencyRequest, subscribeEmergency } from "../../db/queries/emergency";
import type { DbError } from "../../db/queries/helpers";
import type { DbEmergencyRequest } from "../../db/types";
import { QUERY_ROOTS } from "../api/query-roots";
import { useDb } from "./shared";

/** An SOS request that updates live: Realtime pushes every change (status, ETA, hospitals) into the cache. */
export function useEmergencyRequest(id: string | undefined) {
  const { sb, ready } = useDb();
  const queryClient = useQueryClient();
  const queryKey = [QUERY_ROOTS.emergency, id];

  useEffect(() => {
    if (!ready || !id) return;
    return subscribeEmergency(sb, id, (row) => queryClient.setQueryData([QUERY_ROOTS.emergency, id], row));
  }, [sb, ready, id, queryClient]);

  return useQuery<DbEmergencyRequest, DbError>({
    queryKey,
    queryFn: () => getEmergencyRequest(sb, id as string),
    enabled: ready && !!id,
  });
}
