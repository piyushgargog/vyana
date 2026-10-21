import type { ShareMemory } from "@vyana/shared";
import { Card, CardHeader } from "@/components/ui";
import { adherenceDayState, adherenceTotals, formatShareDate, type AdherenceDayState } from "./share-utils";

const SQUARE_CLASS: Record<AdherenceDayState, string> = {
  taken: "bg-ok",
  missed: "bg-danger",
  skipped: "bg-warn",
  none: "bg-fill-strong",
};

/**
 * The adherence strip (issue #238): one square per day of the last 30 days —
 * green where every dose was taken, red where any dose was missed, amber where
 * doses were only skipped, grey where none were due — and the taken percentage
 * the record itself carries. The squares never round a partly-kept day up.
 */
export function ShareAdherence({ adherence }: { adherence: NonNullable<ShareMemory["adherence"]> }) {
  const days = [...adherence.days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const totals = adherenceTotals(days);

  return (
    <section id="adherence" className="scroll-mt-24">
      <Card className="share-section space-y-4">
        <CardHeader title="Medicine adherence (last 30 days)" />

        {days.length === 0 ? (
          <p className="text-[14px] text-label-3 py-2">No doses were scheduled in this period.</p>
        ) : (
          <>
            <ul aria-label="Doses taken, day by day" className="flex flex-wrap gap-1.5 [print-color-adjust:exact]">
              {days.map((day) => {
                const label = `${formatShareDate(day.date)}: ${day.taken} taken, ${day.missed} missed, ${day.skipped} skipped`;
                return (
                  <li
                    key={day.date}
                    title={label}
                    aria-label={label}
                    className={`h-6 w-6 rounded-md ${SQUARE_CLASS[adherenceDayState(day)]}`}
                  />
                );
              })}
            </ul>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-label-2" aria-hidden="true">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-ok" /> All taken
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-danger" /> A dose missed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-warn" /> Skipped
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded bg-fill-strong" /> None due
              </span>
            </div>

            <p className="text-[14px] text-label-2">
              {adherence.percent_taken != null ? (
                <>
                  <strong className="text-label">{adherence.percent_taken}% of doses taken</strong> ·{" "}
                </>
              ) : null}
              {totals.taken} taken · {totals.missed} missed · {totals.skipped} skipped,{" "}
              {formatShareDate(days[0].date)} – {formatShareDate(days[days.length - 1].date)}
            </p>
          </>
        )}
      </Card>
    </section>
  );
}
