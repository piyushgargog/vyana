import type { ShareMemory } from "@vyana/shared";
import { Card, CardHeader } from "@/components/ui";
import { formatShareDate, medicineScale } from "./share-utils";

/**
 * Medicines over time (issue #238): one bar per medicine on one shared time
 * scale, from its start to its end — or to today when it has no end, which the
 * bar says ("ongoing"). Hand-made SVG, no chart library.
 */
export function ShareMedicinesTimeline({ medicines }: { medicines: NonNullable<ShareMemory["medicines"]> }) {
  if (medicines.length === 0) return null;
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
  const meds = [...medicines].sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const scale = medicineScale(meds, today);
  if (!scale) return null;

  const width = 720;
  const rowH = 44;
  const padX = 4;
  const axisH = 20;
  const height = meds.length * rowH + axisH;
  const span = scale.endMs - scale.startMs;
  const x = (iso: string) =>
    padX + ((new Date(`${iso}T00:00:00.000Z`).getTime() - scale.startMs) / span) * (width - padX * 2);

  // One tick per New Year inside the scale, so long courses read against the years.
  const firstYear = new Date(scale.startMs).getUTCFullYear();
  const lastYear = new Date(scale.endMs).getUTCFullYear();
  const yearTicks: { year: number; at: number }[] = [];
  for (let y = firstYear; y <= lastYear; y++) {
    const at = new Date(`${y}-01-01T00:00:00.000Z`).getTime();
    if (at > scale.startMs && at < scale.endMs) yearTicks.push({ year: y, at });
  }

  return (
    <section id="medicines" className="scroll-mt-24">
      <Card className="share-section space-y-3">
        <CardHeader title="Medicines over time" />
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Medicine courses over time for ${meds.length} medicines, from ${formatShareDate(
            new Date(scale.startMs).toISOString().slice(0, 10),
          )} to ${formatShareDate(new Date(scale.endMs).toISOString().slice(0, 10))}`}
          className="w-full [print-color-adjust:exact]"
        >
          {yearTicks.map((t) => (
            <g key={t.year}>
              <line
                x1={padX + ((t.at - scale.startMs) / span) * (width - padX * 2)}
                y1={0}
                x2={padX + ((t.at - scale.startMs) / span) * (width - padX * 2)}
                y2={height - axisH}
                stroke="var(--color-separator)"
                strokeWidth={1}
              />
              <text
                x={padX + ((t.at - scale.startMs) / span) * (width - padX * 2)}
                y={height - 6}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-label-3)"
              >
                {t.year}
              </text>
            </g>
          ))}
          {meds.map((med, i) => {
            const yTop = i * rowH;
            const x1 = x(med.start);
            const x2 = x(med.end ?? today);
            const ongoing = med.end == null;
            return (
              <g key={`${med.name}-${med.start}-${i}`}>
                <text x={padX} y={yTop + 13} fontSize="12" fontWeight="600" fill="var(--color-label)">
                  {med.name}
                  {med.strength ? ` ${med.strength}` : ""} · {med.dose ? `${med.dose} · ` : ""}
                  {med.frequency}
                </text>
                <rect
                  x={x1}
                  y={yTop + 20}
                  width={Math.max(6, x2 - x1)}
                  height={10}
                  rx={5}
                  fill={ongoing ? "var(--color-accent)" : "var(--color-label-3)"}
                >
                  <title>{`${med.name}: ${formatShareDate(med.start)} – ${
                    ongoing ? "ongoing" : formatShareDate(med.end as string)
                  }`}</title>
                </rect>
                <text x={x1} y={yTop + 41} fontSize="10" fill="var(--color-label-2)">
                  {formatShareDate(med.start)} – {ongoing ? "ongoing" : formatShareDate(med.end as string)}
                </text>
              </g>
            );
          })}
        </svg>
      </Card>
    </section>
  );
}
