// apps/mobile/src/lib/health-background.test.ts
// The background sync's gate (issue #448): it may only read the health store when this
// phone's provider holds a connected connection — the row the consent-gated connect
// flow writes. Everything else is a no-op.
// Owner: Vaibhav Parmar

import type { DbDeviceConnection } from "@vyana/shared";
import { describe, expect, it } from "vitest";

import { hasConnectedDevice } from "./health/gate";

const row = (over: Partial<DbDeviceConnection>): DbDeviceConnection =>
  ({
    id: "c-1",
    patient_id: "p-1",
    provider: "health_connect",
    status: "connected",
    permissions: [],
    last_sync_at: null,
    last_error: null,
    created_at: "2026-10-23T00:00:00Z",
    ...over,
  }) as DbDeviceConnection;

describe("hasConnectedDevice", () => {
  it("is false with no connections at all", () => {
    expect(hasConnectedDevice([], "health_connect")).toBe(false);
  });

  it("is true when this provider is connected", () => {
    expect(hasConnectedDevice([row({})], "health_connect")).toBe(true);
  });

  it("is false for a paused or revoked connection", () => {
    expect(hasConnectedDevice([row({ status: "paused" })], "health_connect")).toBe(false);
    expect(hasConnectedDevice([row({ status: "revoked" })], "health_connect")).toBe(false);
  });

  it("is false when only the other platform is connected", () => {
    expect(hasConnectedDevice([row({ provider: "healthkit" })], "health_connect")).toBe(false);
  });
});
