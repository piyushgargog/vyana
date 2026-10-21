import type { ShareMemory } from "@vyana/shared";
import { Card, CardHeader } from "@/components/ui";
import { TrendChartSvg } from "@/components/ui-primitives";
import { flagText, formatChartDate, formatShareDate } from "./share-utils";

/**
 * Lab trends of the Memory Graph (issue #238): one hand-made SVG trend per test,
 * with the stored reference range as the shaded band and each point coloured by
 * its stored flag. A test with a single measurement is written out, not charted —
 * one point is not a trend.
 */
export function ShareLabTrends({ labs }: { labs: NonNullable<ShareMemory["labs"]> }) {
  const tests = labs.filter((t) => t.points.length > 0);
  if (tests.length === 0) return null;

  return (
    <section id="labs" className="scroll-mt-24">
      <Card className="share-section space-y-5">
        <CardHeader title="Lab trends" />
        {tests.map((test) => {
          const sorted = [...test.points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
          const latest = sorted[sorted.length - 1];
          const unit = test.unit ?? "";
          return (
            <div key={test.test_name} className="space-y-2">
              {sorted.length >= 2 ? (
                <TrendChartSvg
                  title={test.test_name}
                  unit={unit}
                  points={sorted.map((p) => ({ date: formatChartDate(p.date), value: p.value, flag: p.flag }))}
                  refLow={test.ref_low}
                  refHigh={test.ref_high}
                />
              ) : (
                <div className="rounded-xl border border-separator bg-fill/40 p-4">
                  <h3 className="text-sm font-semibold text-label">
                    {test.test_name}
                    {unit ? ` (${unit})` : ""}
                  </h3>
                  <p className="text-[13px] text-label-2">Only one measurement in this period.</p>
                </div>
              )}
              <p className="text-[13px] text-label-2">
                Latest:{" "}
                <strong className="text-label">
                  {latest.value}
                  {unit ? ` ${unit}` : ""}
                </strong>{" "}
                on {formatShareDate(latest.date)}
                {flagText(latest.flag) ? ` (${flagText(latest.flag)})` : ""}
                {test.ref_low != null && test.ref_high != null
                  ? ` · Reference range: ${test.ref_low} – ${test.ref_high}${unit ? ` ${unit}` : ""}`
                  : ""}
              </p>
            </div>
          );
        })}
      </Card>
    </section>
  );
}
