// The Activity card (issue #328): today's steps, resting heart rate and last
// night's sleep from the connected device, on the dashboard. Mirrors the mobile
// card — every value names its device, nothing is coloured as good or bad, and
// the steps ring fills only when a goal exists. Devices connect in the phone
// app; this card only reads.

"use client";

import React from "react";

import { ButtonLink, Card, CardHeader } from "@/components/ui";
import { useActivityCard } from "@/components/use-device-activity";

const ARROWS = { up: "↑", down: "↓", same: "→" } as const;

function StepsRing({ fill, value }: { fill: number; value: number }) {
  const size = 92;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Steps today: ${value.toLocaleString("en-IN")}`}
    >
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-fill-strong" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * fill} ${c}`}
          className="stroke-accent"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold text-label">{value.toLocaleString("en-IN")}</span>
        <span className="text-[11px] text-label-3">steps</span>
      </div>
    </div>
  );
}

export function ActivityCard() {
  // No step goal exists in the profile yet, so the goal is null and the card
  // shows the plain number (issue #328 leaves the goal's home as a question).
  const model = useActivityCard(null);
  const { steps, resting_hr: hr, sleep } = model;

  return (
    <Card>
      <CardHeader title="Activity" />
      {!model.has_data ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[15px] text-label-2">
            No device readings yet. Connect a watch or band in the Vyana phone app and steps,
            resting heart rate and sleep will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {steps ? (
            <div className="flex items-center gap-4">
              {steps.fill !== null ? (
                <StepsRing fill={steps.fill} value={steps.value} />
              ) : (
                <div className="flex min-w-[92px] flex-col items-start">
                  <span className="text-[28px] font-bold leading-8 text-label">
                    {steps.value.toLocaleString("en-IN")}
                  </span>
                  <span className="text-[11px] text-label-3">steps</span>
                </div>
              )}
              <div className="flex flex-col gap-0.5">
                <span className="text-[17px] font-semibold text-label">Steps today</span>
                {steps.goal !== null ? (
                  <span className="text-[13px] text-label-2">
                    Goal {steps.goal.toLocaleString("en-IN")}
                  </span>
                ) : null}
                <span className="text-[13px] text-label-3">from {steps.from}</span>
              </div>
            </div>
          ) : null}

          {hr ? (
            <div className="flex items-center justify-between gap-3 border-t border-separator pt-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[17px] font-semibold text-label">Resting heart rate</span>
                <span className="text-[13px] text-label-3">from {hr.from}</span>
              </div>
              <div className="flex flex-col items-end gap-0.5">
                <span className="text-xl font-semibold text-label">{hr.value} bpm</span>
                {hr.arrow !== null && hr.average_7d !== null ? (
                  <span className="text-[13px] text-label-2">
                    {ARROWS[hr.arrow]} 7-day average {Math.round(hr.average_7d)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {sleep ? (
            <div className="flex items-center justify-between gap-3 border-t border-separator pt-4">
              <div className="flex flex-col gap-0.5">
                <span className="text-[17px] font-semibold text-label">Sleep last night</span>
                <span className="text-[13px] text-label-3">from {sleep.from}</span>
              </div>
              <span className="text-xl font-semibold text-label">{sleep.text}</span>
            </div>
          ) : null}

          <div>
            <ButtonLink href="/health/trends" variant="secondary">
              Health trends
            </ButtonLink>
          </div>
        </div>
      )}
    </Card>
  );
}
