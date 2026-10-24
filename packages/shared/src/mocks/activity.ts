// Fictional device data for the wearables screens (issue #328): two weeks of daily
// aggregates from one fictional watch, plus spot readings. Invented values only — they
// exist so the Activity card and the trends screen can be built and screenshotted before
// the device data layer (issue #325) lands; `today` is the fixture's own day, so the demo
// always shows a full "today" and a full last night.

import { addDays } from "../health/dates";
import type { DailyActivityRow, DeviceSpotReading } from "../health/activity";

export const activityMockToday = "2026-10-22";

const stepsByBack = [8_450, 7_900, 8_820, 8_100, 8_640, 7_720, 8_310, 6_480, 6_120, 6_900, 6_350, 6_720, 6_050, 6_580];
const sleepByBack = [452, 438, 465, 449, 471, 430, 458, 444, 460, 436, 452, 441, 455, 447];
const hrByBack = [62, 63, 61, 62, 64, 62, 63, 64, 63, 65, 64, 63, 64, 65];

export const activityMockDays: DailyActivityRow[] = stepsByBack.map((steps, back) => ({
  day: addDays(activityMockToday, -back),
  steps,
  sleep_minutes: sleepByBack[back],
  resting_hr: hrByBack[back],
  source: "health_connect",
  device_name: "Pixel Watch",
}));

const at = (back: number, time: string) => `${addDays(activityMockToday, -back)}T${time}.000Z`;

export const activityMockReadings: DeviceSpotReading[] = [
  { type: "spo2", value: 98, value2: null, unit: "%", measured_at: at(0, "02:10:00"), source: "health_connect", device_name: "Pixel Watch" },
  { type: "spo2", value: 97, value2: null, unit: "%", measured_at: at(2, "02:40:00"), source: "health_connect", device_name: "Pixel Watch" },
  { type: "spo2", value: 98, value2: null, unit: "%", measured_at: at(5, "03:05:00"), source: "health_connect", device_name: "Pixel Watch" },
  { type: "bp", value: 128, value2: 84, unit: "mmHg", measured_at: at(1, "01:30:00"), source: "health_connect", device_name: "Pixel Watch" },
  { type: "bp", value: 126, value2: 82, unit: "mmHg", measured_at: at(4, "01:45:00"), source: "health_connect", device_name: "Pixel Watch" },
  { type: "bp", value: 130, value2: 85, unit: "mmHg", measured_at: at(8, "02:00:00"), source: "health_connect", device_name: "Pixel Watch" },
  { type: "sugar_fasting", value: 104, value2: null, unit: "mg/dL", measured_at: at(0, "01:00:00"), source: "health_connect", device_name: "Pixel Watch" },
  { type: "sugar_random", value: 142, value2: null, unit: "mg/dL", measured_at: at(1, "07:30:00"), source: "health_connect", device_name: "Pixel Watch" },
  { type: "sugar_fasting", value: 101, value2: null, unit: "mg/dL", measured_at: at(3, "01:05:00"), source: "health_connect", device_name: "Pixel Watch" },
  { type: "weight", value: 70.4, value2: null, unit: "kg", measured_at: at(1, "01:20:00"), source: "health_connect", device_name: "Pixel Watch" },
  { type: "weight", value: 70.9, value2: null, unit: "kg", measured_at: at(9, "01:25:00"), source: "health_connect", device_name: "Pixel Watch" },
  { type: "heart_rate", value: 78, value2: null, unit: "bpm", measured_at: at(0, "10:00:00"), source: "health_connect", device_name: "Pixel Watch" },
  { type: "heart_rate", value: 82, value2: null, unit: "bpm", measured_at: at(2, "10:05:00"), source: "health_connect", device_name: "Pixel Watch" },
];

/** The same screens with nothing recorded: the empty state. */
export const activityEmptyMock: { today: string; days: DailyActivityRow[]; readings: DeviceSpotReading[] } = {
  today: activityMockToday,
  days: [],
  readings: [],
};
