// apps/mobile/src/lib/health/triggers.ts
// When the sync runs (issue #326): after connecting (the connect flow calls syncHealth
// itself), when the app comes to the foreground — at most every 15 minutes — and as a
// best-effort background task. The background task can only be defined at module scope
// of the app entry, so the app calls defineHealthBackgroundTask once with its runner.
// Owner: Vaibhav Parmar

import { AppState, type AppStateStatus } from "react-native";
import * as BackgroundTask from "expo-background-task";
import * as TaskManager from "expo-task-manager";

import type { SyncResult } from "./sync";

export const HEALTH_SYNC_TASK = "vyana-health-sync";
export const FOREGROUND_MIN_INTERVAL_MINUTES = 15;

/** Runs `run` whenever the app becomes active, throttled; returns the unsubscribe. */
export function watchForegroundSync(run: () => Promise<SyncResult>, minMinutes = FOREGROUND_MIN_INTERVAL_MINUTES): () => void {
  let lastRunAt = 0;
  let running = false;
  const maybe = () => {
    const now = Date.now();
    if (running || now - lastRunAt < minMinutes * 60_000) return;
    running = true;
    lastRunAt = now;
    void run()
      .catch(() => undefined)
      .finally(() => {
        running = false;
      });
  };
  const sub = AppState.addEventListener("change", (state: AppStateStatus) => {
    if (state === "active") maybe();
  });
  return () => sub.remove();
}

/** Defines the background task. Call once, at module scope, before registration. */
export function defineHealthBackgroundTask(getRunner: () => Promise<SyncResult>): void {
  TaskManager.defineTask(HEALTH_SYNC_TASK, async () => {
    try {
      const result = await getRunner();
      return result.status === "ok" ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Asks the system to run the task periodically (it decides when; 15 minutes is a floor, in minutes). */
export async function registerHealthBackgroundSync(): Promise<void> {
  await BackgroundTask.registerTaskAsync(HEALTH_SYNC_TASK, { minimumInterval: FOREGROUND_MIN_INTERVAL_MINUTES });
}
