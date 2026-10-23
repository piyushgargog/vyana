import type { ShareMemory } from "@vyana/shared";
import { Card, CardHeader } from "@/components/ui";
import { TrendChartSvg, type TrendPoint } from "@/components/ui-primitives";
import { formatChartDateTime, latestVitalLine, vitalTitle } from "./share-utils";

/**
 * Vitals of the Memory Graph (issue #238): one line per vital type over the last
 * 12 months. Blood pressure carries its second number as a second line (the
 * contract's `value2`, the diastolic); a reading without one leaves a gap in that
 * line rather than a point in the wrong place.
 */
export function ShareVitals({ vitals }: { vitals: NonNullable<ShareMemory["vitals"]> }) {
  const series = vitals.filter((v) => v.points.length > 0);
  if (series.length === 0) return null;

  return (
    <section id="vitals" className="scroll-mt-24">
      <Card className="share-section space-y-5">
        <CardHeader title="Vitals" />
        {series.map((vital) => {
          const sorted = [...vital.points].sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
          const isBp = vital.type === "blood_pressure";
          const points: TrendPoint[] = sorted.map((p) => ({
            date: formatChartDateTime(p.at),
            value: p.value,
          }));
          const points2: (TrendPoint | null)[] = sorted.map((p) =>
            p.value2 != null ? { date: formatChartDateTime(p.at), value: p.value2 } : null,
          );
          const hasSecond = points2.some((p) => p !== null);
          // Device readings are marked as such in the line under the chart (issue
          // #328); manual readings carry no mark and read exactly as before.
          const latestLine = latestVitalLine(sorted, vital.unit);
          return (
            <div key={vital.type} className="space-y-2">
              <TrendChartSvg
                title={vitalTitle(vital.type)}
                unit={vital.unit ?? ""}
                points={points}
                points2={hasSecond ? points2 : undefined}
                seriesLabel={isBp ? "Systolic" : "First reading"}
                series2Label={isBp ? "Diastolic" : "Second reading"}
              />
              {latestLine ? <p className="px-4 text-[13px] text-label-2">{latestLine}</p> : null}
            </div>
          );
        })}
      </Card>
    </section>
  );
}
