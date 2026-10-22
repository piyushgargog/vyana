// Health trends (issue #328): one chart per device metric over 7, 30 or 90 days.
// Read-only — devices connect in the phone app. The sentence under a steps /
// heart-rate / sleep chart is the fixed sentence of `describeTrend` (via the
// shared builders); this page writes no trend text of its own. SpO2, blood
// pressure and glucose carry the fixed line that a device reading is not a
// medical test, and no chart labels a value high, low or normal.

"use client";

import React, { useState } from "react";
import type { TrendChartModel, TrendRangeDays } from "@vyana/shared";

import { TrendChartSvg } from "@/components/ui-primitives";
import { Card, EmptyState, LargeTitle, Reveal } from "@/components/ui";
import { useTrendCharts } from "@/components/use-device-activity";
import { cn } from "@/components/ui/cn";

const RANGES: { days: TrendRangeDays; label: string }[] = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
];

const fmtDay = (day: string) =>
  new Date(`${day}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

/** "Latest: 128/84 mmHg · 21 Oct, 7:00 am · from Pixel Watch" — day only for daily totals. */
function latestLine(chart: TrendChartModel): string | null {
  const latest = chart.latest;
  if (!latest) return null;
  const when = latest.at
    ? `${fmtDay(latest.day)}, ${new Date(latest.at).toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Asia/Kolkata",
      })}`
    : fmtDay(latest.day);
  return `Latest: ${latest.text} · ${when} · from ${latest.from}`;
}

function ChartBlock({ chart }: { chart: TrendChartModel }) {
  const latest = latestLine(chart);
  return (
    <div className="space-y-2">
      <TrendChartSvg
        title={chart.title}
        unit={chart.unit}
        points={chart.points.map((p) => ({ date: p.day, value: p.value }))}
        points2={
          chart.points2
            ? chart.points2.map((p) => (p ? { date: p.day, value: p.value } : null))
            : undefined
        }
        seriesLabel={chart.metric === "bp" ? "Systolic" : undefined}
        series2Label={chart.metric === "bp" ? "Diastolic" : undefined}
        label={chart.label}
      />
      <div className="space-y-1 px-4">
        {chart.sentence ? <p className="text-[13px] text-label-2">{chart.sentence}</p> : null}
        {latest ? <p className="text-[13px] text-label-2">{latest}</p> : null}
        {chart.note ? <p className="text-[13px] text-label-3">{chart.note}</p> : null}
      </div>
    </div>
  );
}

export default function HealthTrendsPage() {
  const [range, setRange] = useState<TrendRangeDays>(7);
  const charts = useTrendCharts(range);

  return (
    <div className="space-y-6">
      <Reveal>
        <LargeTitle eyebrow="From your devices" title="Health trends" />
      </Reveal>

      <div className="flex flex-wrap gap-1 rounded-full bg-fill p-1" role="group" aria-label="Days to show">
        {RANGES.map((r) => {
          const selected = range === r.days;
          return (
            <button
              key={r.days}
              type="button"
              aria-pressed={selected}
              onClick={() => setRange(r.days)}
              className={cn(
                "inline-flex min-h-[44px] items-center rounded-full px-4 text-[14px] transition-colors",
                selected
                  ? "bg-surface font-semibold text-label shadow-[0_1px_4px_rgb(0_0_0/0.08)]"
                  : "text-label-2 hover:text-label",
              )}
            >
              {r.label}
            </button>
          );
        })}
      </div>

      {charts.length === 0 ? (
        <Card>
          <EmptyState
            title="No device readings yet"
            body="Connect a watch or band in the Vyana phone app and readings you record will appear here as trends."
          />
        </Card>
      ) : (
        charts.map((chart) => <ChartBlock key={chart.metric} chart={chart} />)
      )}
    </div>
  );
}
