import type { ShareRes } from "@vyana/shared";
import { Card, CardHeader, Pill } from "@/components/ui";
import { formatShareDate } from "./share-utils";

/**
 * The record's events on one time axis (issue #238): newest first, as the record
 * returns them, each on the shared line with its date written beside it. The axis
 * orders the events; the spacing is even, and the dates carry the time information.
 */
export function ShareTimeline({ events }: { events: ShareRes["timeline"] }) {
  if (!events || events.length === 0) return null;
  return (
    <section id="timeline" className="scroll-mt-24">
      <Card className="share-section space-y-4">
        <CardHeader title={`Clinical history & timeline (${events.length} events)`} />

        <ol className="relative space-y-3 border-l-2 border-accent/40 pl-4 ml-2">
          {events.map((event, idx) => (
            <li
              key={idx}
              className="relative rounded-row border border-separator bg-fill/40 p-3.5 text-[13px] space-y-1"
            >
              <span
                aria-hidden="true"
                className="absolute -left-[23px] top-4 h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-surface"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-label-3 text-[12px]">{formatShareDate(event.date)}</span>
                <Pill tone="neutral">{event.kind}</Pill>
              </div>
              <h3 className="font-semibold text-label text-[14px]">{event.title}</h3>
              {event.summary && <p className="text-label-2 leading-relaxed">{event.summary}</p>}
            </li>
          ))}
        </ol>
      </Card>
    </section>
  );
}
