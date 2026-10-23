// Device activity for the wearables screens on web (issue #328): the dashboard
// Activity card and the Health trends page both read through here. Same deal as the
// mobile hook — the device data layer (issue #325) is not on main yet, so mock mode
// serves the shared fixture and real mode serves nothing, and the screens show
// their empty state. Devices connect in the phone app; web only ever reads.

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

import { useVyanaWeb } from "@/components/providers";

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
  const { useMocks } = useVyanaWeb();
  return useMemo(
    () =>
      useMocks
        ? { today: mocks.activityMockToday, days: mocks.activityMockDays, readings: mocks.activityMockReadings }
        : { today: indiaToday(), days: [], readings: [] },
    [useMocks],
  );
}

/** The dashboard card's model. `stepGoal` is null until the profile carries one (issue #328). */
export function useActivityCard(stepGoal: number | null): ActivityCardModel {
  const { today, days } = useDeviceActivity();
  return useMemo(() => buildActivityCard(days, today, stepGoal), [days, today, stepGoal]);
}

/** The trend charts for one range, in display order; metrics without data are absent. */
export function useTrendCharts(range: TrendRangeDays): TrendChartModel[] {
  const { today, days, readings } = useDeviceActivity();
  return useMemo(() => buildTrendCharts(days, readings, range, today), [days, readings, range, today]);
}
