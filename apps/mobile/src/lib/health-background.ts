// apps/mobile/src/lib/health-background.ts
// The background health sync, wired at app start (issue #448). The root layout calls
// startHealthBackgroundSync() at module scope: TaskManager tasks must be defined in a
// file that is loaded at start, or the system cannot hand the work to them.
// Owner: Vaibhav Parmar

import { getConnections } from "@vyana/shared";

import {
  createHealthSource,
  createHealthSync,
  defineHealthBackgroundTask,
  registerHealthBackgroundSync,
  type SyncResult,
} from "./health";
import { hasConnectedDevice } from "./health/gate";
import { supabase } from "./supabase";

/** A run that had nothing to do: nothing written, nothing wrong. */
const NOTHING_TO_SYNC: SyncResult = {
  status: "ok",
  daysWritten: 0,
  readingsWritten: 0,
  dropped: 0,
  errorCode: null,
};

async function runBackgroundSync(): Promise<SyncResult> {
  const source = createHealthSource();
  const rows = await getConnections(supabase).catch(() => null);
  if (!rows || !hasConnectedDevice(rows, source.id)) return NOTHING_TO_SYNC;
  return createHealthSync(supabase).syncNow();
}

let started = false;

/** Defines the background task and asks the system to run it. Call once, at module scope. */
export function startHealthBackgroundSync(): void {
  if (started) return;
  started = true;
  defineHealthBackgroundTask(runBackgroundSync);
  void registerHealthBackgroundSync().catch(() => undefined);
}
