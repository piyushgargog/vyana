// packages/shared/src/mocks/devices.ts
// The connected-devices store (#327, ADR-073), mock-first: the screens and hooks work
// against this in-memory store until Vaibhav's W2 sync engine (one HealthSource
// interface over Health Connect / HealthKit) replaces it. Nothing here invents a
// reading: it holds only the connection state — no values, no thresholds, no advice.

import {
  DeviceConnection,
  DeviceConnectionsRes,
  type DevicePlatform,
} from "../contracts";
import { ALL_DEVICE_METRICS } from "../devices";

interface DeviceStore {
  consentGranted: boolean;
  connections: DeviceConnection[];
}

function freshStore(): DeviceStore {
  return {
    consentGranted: false,
    connections: ALL_PLATFORMS.map((platform) =>
      DeviceConnection.parse({
        platform,
        available: true,
        status: "not_connected",
        last_synced_at: null,
        last_sync_failed: false,
        metrics: ALL_DEVICE_METRICS,
      })
    ),
  };
}

const ALL_PLATFORMS: DevicePlatform[] = ["health_connect", "apple_health"];

let store: DeviceStore = freshStore();

export function resetDevicesMock(): void {
  store = freshStore();
}

export function deviceConnectionsMock(): DeviceConnectionsRes {
  return DeviceConnectionsRes.parse({
    consent_granted: store.consentGranted,
    connections: store.connections,
  });
}

export function setDeviceConsentMock(granted: boolean): DeviceConnectionsRes {
  store = { ...store, consentGranted: granted };
  return deviceConnectionsMock();
}

function updateConnection(
  platform: DevicePlatform,
  patch: Partial<DeviceConnection>
): DeviceConnection {
  const next = store.connections.map((c) =>
    c.platform === platform ? DeviceConnection.parse({ ...c, ...patch }) : c
  );
  store = { ...store, connections: next };
  return next.find((c) => c.platform === platform) as DeviceConnection;
}

/** Connecting without the "Device health data" consent is not possible (#327). */
export function connectDeviceMock(platform: DevicePlatform): DeviceConnection {
  if (!store.consentGranted) {
    throw new Error("Device health data consent is off. Turn it on from the consent screen first.");
  }
  return updateConnection(platform, {
    status: "connected",
    last_synced_at: new Date().toISOString(),
    last_sync_failed: false,
  });
}

export function pauseDeviceMock(platform: DevicePlatform): DeviceConnection {
  return updateConnection(platform, { status: "paused" });
}

export function resumeDeviceMock(platform: DevicePlatform): DeviceConnection {
  return updateConnection(platform, { status: "connected" });
}

/** A sync stamps the time and clears a failed flag — the engine's result, mocked. */
export function syncDeviceMock(platform: DevicePlatform): DeviceConnection {
  return updateConnection(platform, {
    last_synced_at: new Date().toISOString(),
    last_sync_failed: false,
  });
}

/** Disconnect and delete: the connection goes and every device reading with it.
 *  What the person typed in themselves is not device data and is never touched here. */
export function deleteMyDeviceDataMock(platform: DevicePlatform): DeviceConnection {
  return updateConnection(platform, {
    status: "not_connected",
    last_synced_at: null,
    last_sync_failed: false,
  });
}
