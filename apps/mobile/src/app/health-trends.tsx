// Health trends (issue #328): one chart per device metric over 7, 30 or 90 days.
// The sentence under a steps / heart-rate / sleep chart is the fixed sentence of
// `describeTrend` (via the shared builders) — this screen writes no trend text of
// its own. SpO2, blood pressure and glucose carry the fixed line that a device
// reading is not a medical test, and no chart here labels a value high, low or
// normal: the bars are all the neutral accent.

import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import type { TrendChartModel, TrendRangeDays } from "@vyana/shared";

import { Button, Card, EmptyState, Screen, Text } from "@/components/ui";
import { MobileTrendChart, shortChartDate } from "@/components/ui-primitives";
import { T } from "@/constants/theme";
import { useTrendCharts } from "@/hooks/use-device-activity";

const RANGES: { days: TrendRangeDays; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

/** "Latest: 128/84 mmHg · 21 Oct, 7:00 am · from Pixel Watch" — day only for daily totals. */
function latestLine(chart: TrendChartModel): string | null {
  const latest = chart.latest;
  if (!latest) return null;
  const when = latest.at
    ? `${shortChartDate(latest.day)}, ${new Date(latest.at).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
      })}`
    : shortChartDate(latest.day);
  return `Latest: ${latest.text} · ${when} · from ${latest.from}`;
}

function ChartBlock({ chart }: { chart: TrendChartModel }) {
  const latest = latestLine(chart);
  return (
    <View style={styles.chartBlock}>
      <MobileTrendChart
        title={chart.title}
        unit={chart.unit}
        // Blood pressure charts the systolic line; the pair itself is in the
        // latest reading under the chart.
        points={chart.points.map((p) => ({ date: p.day, value: p.value }))}
        label={chart.label}
        flags={false}
      />
      <View style={styles.underChart}>
        {chart.sentence ? (
          <Text variant="footnote" tone="secondary">
            {chart.sentence}
          </Text>
        ) : null}
        {latest ? (
          <Text variant="footnote" tone="secondary">
            {latest}
          </Text>
        ) : null}
        {chart.note ? (
          <Text variant="footnote" tone="tertiary">
            {chart.note}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export default function HealthTrendsScreen() {
  const router = useRouter();
  const [range, setRange] = useState<TrendRangeDays>(7);
  const charts = useTrendCharts(range);

  return (
    <Screen title="Health trends" eyebrow="From your devices">
      <View style={styles.segmented}>
        {RANGES.map((r) => {
          const selected = range === r.days;
          return (
            <Pressable
              key={r.days}
              accessibilityRole="button"
              accessibilityLabel={r.label}
              accessibilityState={{ selected }}
              onPress={() => setRange(r.days)}
              style={[styles.segment, selected && styles.segmentActive]}
            >
              <Text
                variant="footnote"
                tone={selected ? "white" : "secondary"}
                style={styles.segmentText}
              >
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {charts.length === 0 ? (
        <Card>
          <EmptyState
            ios="waveform.path.ecg"
            android="monitor_heart"
            title="No device readings yet"
            body="Connect a watch or band and readings you record will appear here as trends."
            action={
              <Button
                title="Connected devices"
                variant="primary"
                size="md"
                onPress={() => router.push("/devices")}
              />
            }
          />
        </Card>
      ) : (
        charts.map((chart) => <ChartBlock key={chart.metric} chart={chart} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: "row",
    backgroundColor: T.color.fill,
    borderRadius: T.radius.pill,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: T.radius.pill,
  },
  segmentActive: { backgroundColor: T.color.accent },
  segmentText: { fontWeight: "600" },
  chartBlock: { gap: T.space.sm },
  underChart: { gap: T.space.xs, paddingHorizontal: T.space.lg },
});
