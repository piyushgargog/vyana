// apps/mobile/src/lib/health/gate.ts
// The background sync's gate (issue #448), kept pure so it can be tested: the sync may
// only read the health store when this phone's provider holds a `connected` connection
// row. A row appears only through the connect flow, which the consent screen gates on
// the separate device-data consent, and it goes away when the patient disconnects or
// deletes their device data — so no row (or a paused or revoked one) means no read.
// Owner: Vaibhav Parmar

import type { DbDeviceConnection } from "@vyana/shared";

export function hasConnectedDevice(rows: readonly DbDeviceConnection[], provider: string): boolean {
  return rows.some((r) => r.provider === provider && r.status === "connected");
}
