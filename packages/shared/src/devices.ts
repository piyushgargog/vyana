// packages/shared/src/devices.ts
// Connected-devices wording (#327, ADR-073): the metric list and the plain lines the
// screens and the permission explainer use. Labels and explanations only — this file
// holds no reading, no range and no advice text.

import type { DeviceMetric } from "./contracts";

export const ALL_DEVICE_METRICS: DeviceMetric[] = [
  "steps",
  "heart_rate",
  "sleep",
  "blood_oxygen",
  "blood_pressure",
  "blood_glucose",
  "weight",
];

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

/** The fixed line carried by device readings that are not lab results (ADR-073). */
export const DEVICE_READING_NOTE = "A device reading is not a medical test";
