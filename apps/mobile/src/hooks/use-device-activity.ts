// Device activity for the wearables screens (issue #328): the Today Activity card and
// the Health trends screen both read through here.
//
// The device data layer — the `daily_activity` table and device-sourced vitals rows
// (issue #325) — is not on main yet, so this hook serves the shared fixture in mock
// mode and nothing in real mode: the screens show their empty state rather than
// dressing manual readings up as device readings. When the data layer lands, this is
// the one place that changes — feed its rows (daily aggregates + vitals whose source
// is not `manual`) into the same shared builders the screens already use.

import { useMemo } from "react";
import {
  buildActivityCard,
  buildTrendCharts,
  mocks,
  type ActivityCardModel,
  type DailyActivityRow,
  type DeviceSpotReading,
  type TrendChartModel,
  type TrendRangeDays,
} from "@vyana/shared";

import { useVyanaMobile } from "@/components/providers";

export interface DeviceActivity {
  today: string;
  days: DailyActivityRow[];
  readings: DeviceSpotReading[];
}

/** The calendar day in India (`YYYY-MM-DD`) — the day device rows are stored by. */
function indiaToday(): string {
  return new Date(Date.now() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}

export function useDeviceActivity(): DeviceActivity {
  const { useMocks } = useVyanaMobile();
  return useMemo(
    () =>
      useMocks
        ? { today: mocks.activityMockToday, days: mocks.activityMockDays, readings: mocks.activityMockReadings }
        : { today: indiaToday(), days: [], readings: [] },
    [useMocks],
  );
}

/** The Today card's model. `stepGoal` is null until the profile carries one (issue #328). */
export function useActivityCard(stepGoal: number | null): ActivityCardModel {
  const { today, days } = useDeviceActivity();
  return useMemo(() => buildActivityCard(days, today, stepGoal), [days, today, stepGoal]);
}

/** The trend charts for one range, in display order; metrics without data are absent. */
export function useTrendCharts(range: TrendRangeDays): TrendChartModel[] {
  const { today, days, readings } = useDeviceActivity();
  return useMemo(() => buildTrendCharts(days, readings, range, today), [days, readings, range, today]);
}
