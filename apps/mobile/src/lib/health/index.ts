// apps/mobile/src/lib/health/index.ts
// The health sync (issue #326, ADR-073). The app composes it with createHealthSync; the
// pieces are exported for the connect screens (#327) and the tests.
// Owner: Vaibhav Parmar

import { Platform } from "react-native";

import type { Sb } from "@vyana/shared";

import { healthDb } from "./db";
import { HealthConnectSource } from "./healthConnect";
import { HealthKitSource } from "./healthKit";
import { syncHealth, type SyncResult } from "./sync";
import type { HealthSource } from "./types";

export * from "./aggregate";
export * from "./mock";
export * from "./sync";
export * from "./triggers";
export * from "./types";
export { healthDb } from "./db";
export { HealthConnectSource } from "./healthConnect";
export { HealthKitSource } from "./healthKit";

/** The health store of this phone: Health Connect on Android, HealthKit on iOS. */
export function createHealthSource(): HealthSource {
  return Platform.OS === "ios" ? new HealthKitSource() : new HealthConnectSource();
}

/** Source + storage + a ready runner, for the triggers and the connect flow. */
export function createHealthSync(sb: Sb): { source: HealthSource; syncNow: () => Promise<SyncResult> } {
  const source = createHealthSource();
  const db = healthDb(sb, source.id);
  return { source, syncNow: () => syncHealth(source, db) };
}
