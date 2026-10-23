"use client";

// Connected-devices hooks (#327, ADR-073). The names Vaibhav's W2 lands —
// useMockDeviceConnections, useDisconnectDevice, syncHealth — are provisional here:
// they run against the in-memory mock store in mocks/devices until his sync engine
// (one HealthSource over Health Connect / HealthKit) replaces the store. Device data
// never crosses the REST API, so these hooks do not go through useApi().

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import type { DeviceConnection, DeviceConnectionsRes, DevicePlatform } from "../../contracts";
import {
  connectDeviceMock,
  disconnectDeviceMock,
  deviceConnectionsMock,
  pauseDeviceMock,
  resumeDeviceMock,
  setDeviceConsentMock,
  syncDeviceMock,
} from "../../mocks/devices";
import { QUERY_ROOTS } from "./query-roots";

const devicesKey = [QUERY_ROOTS.devices, "connections"] as const;

export function useMockDeviceConnections() {
  return useQuery<DeviceConnectionsRes>({
    queryKey: devicesKey,
    queryFn: async () => deviceConnectionsMock(),
  });
}

/** One sync pass against the health store (mocked until W2). */
export async function syncHealth(platform: DevicePlatform): Promise<DeviceConnection> {
  return syncDeviceMock(platform);
}

function useDeviceMutation<TArg>(
  fn: (arg: TArg) => DeviceConnection | DeviceConnectionsRes
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (arg: TArg) => fn(arg),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [QUERY_ROOTS.devices] });
    },
  });
}

export function useSetDeviceConsent() {
  return useDeviceMutation<boolean>((granted) => setDeviceConsentMock(granted));
}

export function useConnectDevice() {
  return useDeviceMutation<DevicePlatform>((platform) => connectDeviceMock(platform));
}

export function usePauseDevice() {
  return useDeviceMutation<DevicePlatform>((platform) => pauseDeviceMock(platform));
}

export function useResumeDevice() {
  return useDeviceMutation<DevicePlatform>((platform) => resumeDeviceMock(platform));
}

export function useSyncHealth() {
  return useDeviceMutation<DevicePlatform>((platform) => syncDeviceMock(platform));
}

/** Disconnect this device and stop syncing. It does not delete stored readings. */
export function useDisconnectDevice() {
  return useDeviceMutation<DevicePlatform>((platform) => disconnectDeviceMock(platform));
}

/** Hook point for the real delete: PR #349's "delete my device data" database function
 *  (migration 0019) is not on main yet, so nothing calls this. Wire it here, then add a
 *  `useDeleteMyDeviceReadings` mutation and the strong "deletes every reading" wording. */
export async function deleteMyDeviceReadings(_platform: DevicePlatform): Promise<never> {
  throw new Error("Deleting stored device readings is not available yet.");
}
