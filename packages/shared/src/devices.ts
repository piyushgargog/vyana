// packages/shared/src/devices.ts
// Connected-devices wording (#327, ADR-073): the metric list and the plain lines the
// screens and the permission explainer use. Labels and explanations only — this file
// holds no reading, no range and no advice text.

import { DeviceMetric } from "./contracts";

// Derived from the DeviceMetric enum, so adding a metric cannot leave this list behind.
export const ALL_DEVICE_METRICS: DeviceMetric[] = [...DeviceMetric.options];

/** Display name for a metric — labels only, never a value or a range. */
export const DEVICE_METRIC_LABELS: Record<DeviceMetric, string> = {
  steps: "Steps",
  heart_rate: "Heart rate",
  sleep: "Sleep",
  blood_oxygen: "Blood oxygen",
  blood_pressure: "Blood pressure",
  blood_glucose: "Blood glucose",
  weight: "Weight",
};

/** One line per metric for the permission explainer: what Vyana uses it for, nothing more. */
export const DEVICE_METRIC_EXPLAINER: Record<DeviceMetric, string> = {
  steps: "Your daily step total, for the Activity card on Today.",
  heart_rate: "Your resting heart rate and single readings, for trends.",
  sleep: "How long you slept, for the Activity card and trends.",
  blood_oxygen: "Single readings from your device, shown with their time.",
  blood_pressure: "Single readings from your device, shown with their time.",
  blood_glucose: "Single readings from your device, shown with their time.",
  weight: "Your weight readings, for trends.",
};
