import { beforeEach, describe, expect, it } from "vitest";

import {
  connectDeviceMock,
  disconnectDeviceMock,
  deviceConnectionsMock,
  pauseDeviceMock,
  resetDevicesMock,
  resumeDeviceMock,
  setDeviceConsentMock,
  syncDeviceMock,
} from "./devices";

describe("connected devices mock store (#327)", () => {
  beforeEach(() => resetDevicesMock());

  it("starts with consent off and nothing connected", () => {
    const res = deviceConnectionsMock();
    expect(res.consent_granted).toBe(false);
    expect(res.connections).toHaveLength(2);
    expect(res.connections.every((c) => c.status === "not_connected")).toBe(true);
    expect(res.connections.every((c) => c.metrics.length === 7)).toBe(true);
  });

  it("refuses to connect while consent is off", () => {
    expect(() => connectDeviceMock("health_connect")).toThrow(/consent is off/);
    expect(deviceConnectionsMock().connections[0].status).toBe("not_connected");
  });

  it("connects once consent is on, and stamps the sync time", () => {
    setDeviceConsentMock(true);
    const conn = connectDeviceMock("health_connect");
    expect(conn.status).toBe("connected");
    expect(conn.last_synced_at).not.toBeNull();
    expect(conn.last_sync_failed).toBe(false);
  });

  it("pauses and resumes without losing the last sync time", () => {
    setDeviceConsentMock(true);
    connectDeviceMock("apple_health");
    const syncedAt = deviceConnectionsMock().connections[1].last_synced_at;
    pauseDeviceMock("apple_health");
    expect(deviceConnectionsMock().connections[1].status).toBe("paused");
    resumeDeviceMock("apple_health");
    const after = deviceConnectionsMock().connections[1];
    expect(after.status).toBe("connected");
    expect(after.last_synced_at).toBe(syncedAt);
  });

  it("a sync clears the failed flag", () => {
    setDeviceConsentMock(true);
    connectDeviceMock("health_connect");
    const conn = syncDeviceMock("health_connect");
    expect(conn.last_sync_failed).toBe(false);
    expect(conn.last_synced_at).not.toBeNull();
  });

  it("disconnect returns the connection to a clean state", () => {
    setDeviceConsentMock(true);
    connectDeviceMock("health_connect");
    const conn = disconnectDeviceMock("health_connect");
    expect(conn.status).toBe("not_connected");
    expect(conn.last_synced_at).toBeNull();
    // Consent itself is a separate choice and stays as the person left it.
    expect(deviceConnectionsMock().consent_granted).toBe(true);
  });

  it("refuses to sync while consent is off or the device is not connected", () => {
    expect(() => syncDeviceMock("health_connect")).toThrow(/consent is off/);
    setDeviceConsentMock(true);
    expect(() => syncDeviceMock("health_connect")).toThrow(/not connected/);
  });

  it("turning consent off disconnects every device and blocks sync and connect", () => {
    setDeviceConsentMock(true);
    connectDeviceMock("health_connect");
    connectDeviceMock("apple_health");
    const res = setDeviceConsentMock(false);
    expect(res.consent_granted).toBe(false);
    expect(res.connections.every((c) => c.status === "not_connected")).toBe(true);
    expect(res.connections.every((c) => c.last_synced_at === null)).toBe(true);
    expect(() => syncDeviceMock("health_connect")).toThrow(/consent is off/);
    expect(() => connectDeviceMock("health_connect")).toThrow(/consent is off/);
  });

  it("the two platforms are independent", () => {
    setDeviceConsentMock(true);
    connectDeviceMock("health_connect");
    const res = deviceConnectionsMock();
    expect(res.connections.find((c) => c.platform === "apple_health")?.status).toBe(
      "not_connected"
    );
  });
});
