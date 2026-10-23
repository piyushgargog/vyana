"use client";

// packages/shared/src/hooks/db/wearables.ts
// Owner: Vaibhav Parmar

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DbError } from "../../db/queries/helpers";
import { deleteMyDeviceData, getConnections, listDailyActivity } from "../../db/queries/wearables";
import type { DbDailyActivity, DbDeviceConnection } from "../../db/types";
import { DB_KEYS, useDb } from "./shared";

/** The last `days` days of device activity (steps, sleep, ...), oldest first. */
export function useDailyActivity(days: number) {
  const { sb, ready } = useDb();
  return useQuery<DbDailyActivity[], DbError>({
    queryKey: [DB_KEYS.dailyActivity, days],
    queryFn: () => listDailyActivity(sb, days),
    enabled: ready,
  });
}

/** The patient's device connections, one per provider. */
export function useDeviceConnections() {
  const { sb, ready } = useDb();
  return useQuery<DbDeviceConnection[], DbError>({
    queryKey: [DB_KEYS.deviceConnections],
    queryFn: () => getConnections(sb),
    enabled: ready,
  });
}

/**
 * "Disconnect and delete my device data": the device rows go (manual entries stay), so the
 * vitals, activity and connections caches are all cleared — the three keys the data fed.
 */
export function useDeleteMyDeviceData() {
  const { sb } = useDb();
  const queryClient = useQueryClient();
  return useMutation<void, DbError, void>({
    mutationFn: () => deleteMyDeviceData(sb),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [DB_KEYS.vitals] });
      void queryClient.invalidateQueries({ queryKey: [DB_KEYS.dailyActivity] });
      void queryClient.invalidateQueries({ queryKey: [DB_KEYS.deviceConnections] });
    },
  });
}
