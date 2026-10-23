"use client";

import React, { useState } from "react";
import { Sparkles } from "lucide-react";
import { SiteFooter } from "./ui/site-footer";
import {
  buildQrMatrix,
  computeItemRefill,
  generateQrMatrix,
  parseCarePlanJson,
  useReportAiMistake,
} from "@vyana/shared";
import { useVyanaWeb } from "./providers";

export { buildQrMatrix, computeItemRefill, generateQrMatrix, parseCarePlanJson };

export function QrCodeSvg({
  data,
  size = 280,
  label = "Medical ID QR Code",
}: {
  data: string;
  size?: number;
  label?: string;
}) {
  const matrix = buildQrMatrix(data);
  const grid = matrix.length;
  const quiet = 4;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid + quiet * 2} ${grid + quiet * 2}`}
      role="img"
      aria-label={label}
      className="rounded-xl bg-surface p-2 border border-separator shadow-sm"
    >
      <rect width={grid + quiet * 2} height={grid + quiet * 2} fill="var(--color-surface)" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c + quiet}
              y={r + quiet}
              width={1}
              height={1}
              fill="var(--color-label)"
            />
          ) : null
        )
      )}
    </svg>
  );
}

export interface TrendPoint {
  date: string;
  value: number;
  flag?: "low" | "normal" | "high" | "unknown" | null;
}

export function TrendChartSvg({
  title,
  unit,
  points,
  refLow,
  refHigh,
  points2,
  seriesLabel,
  series2Label,
  label,
}: {
  title: string;
  unit: string;
  points: TrendPoint[];
  refLow?: number | null;
  refHigh?: number | null;
  /** A second series on the same axes (e.g. the diastolic line of a blood pressure chart). A null entry is a gap: that reading has no second value, so the line breaks there instead of sliding to the wrong date. */
  points2?: (TrendPoint | null)[];
  seriesLabel?: string;
  series2Label?: string;
  /** Screen-reader label for the chart; defaults to the measurement count. */
  label?: string;
}) {
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-separator bg-fill p-4 text-sm text-label-2">
        No historical data points recorded for {title} yet.
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const allBounds = [
    ...values,
    ...(points2 ?? []).flatMap((p) => (p ? [p.value] : [])),
    ...(typeof refLow === "number" ? [refLow] : []),
    ...(typeof refHigh === "number" ? [refHigh] : []),
  ];
  const minVal = Math.min(...allBounds) * 0.88;
  const maxVal = Math.max(...allBounds) * 1.12 || 100;
  const range = Math.max(maxVal - minVal, 1);

  const width = 540;
  const height = 190;
  const padLeft = 44;
  const padRight = 24;
  const padTop = 22;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const toX = (idx: number) =>
    points.length === 1
      ? padLeft + plotW / 2
      : padLeft + (idx / (points.length - 1)) * plotW;

  const toY = (val: number) =>
    padTop + plotH - ((val - minVal) / range) * plotH;

  const polylinePoints = points
    .map((pt, idx) => `${toX(idx)},${toY(pt.value)}`)
    .join(" ");

  const bandTop = typeof refHigh === "number" ? toY(refHigh) : null;
  const bandBottom = typeof refLow === "number" ? toY(refLow) : null;

  return (
    <div className="rounded-xl border border-separator bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <h3 className="text-sm font-semibold text-label">
            {title} Trend{unit ? ` (${unit})` : ""}
          </h3>
          {typeof refLow === "number" && typeof refHigh === "number" && (
            <p className="text-xs text-label-2">
              Reference range: {refLow} – {refHigh} {unit} (shaded band)
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-3 text-xs">
          {points2 && points2.length > 0 && (
            <>
              <span className="inline-flex items-center gap-1 text-accent-strong font-medium">
                <span className="h-0.5 w-4 rounded bg-accent" /> {seriesLabel ?? "First reading"}
              </span>
              <span className="inline-flex items-center gap-1 text-label-2 font-medium">
                <span className="h-0.5 w-4 rounded bg-label-3" /> {series2Label ?? "Second reading"}
              </span>
            </>
          )}
          {/* The Normal / High / Low key only appears when the points carry a stored flag (vitals have none). */}
          {[...points, ...(points2 ?? [])].some((p) => p?.flag) && (
            <>
              <span className="inline-flex items-center gap-1 text-accent-strong font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Normal
              </span>
              <span className="inline-flex items-center gap-1 text-danger-text font-medium">
                <span className="h-2.5 w-2.5 rounded-full bg-danger" /> High / Low
              </span>
            </>
          )}
          {[...points, ...(points2 ?? [])].some((p) => p?.flag === "unknown") && (
            <span className="inline-flex items-center gap-1 text-label-2 font-medium">
              <span className="h-2.5 w-2.5 rounded-full bg-label-3" /> Not flagged
            </span>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label ?? `${title} trend chart over ${points.length} measurements`}
        className="h-44 w-full min-w-[520px] overflow-visible"
      >
        {bandTop !== null && bandBottom !== null && bandBottom >= bandTop && (
          <rect
            x={padLeft}
            y={bandTop}
            width={plotW}
            height={Math.max(4, bandBottom - bandTop)}
            fill="var(--color-accent-soft)"
            rx={4}
          />
        )}

        <line
          x1={padLeft}
          y1={padTop + plotH}
          x2={padLeft + plotW}
          y2={padTop + plotH}
          stroke="var(--color-separator)"
          strokeWidth={1}
        />

        <polyline
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={2.5}
          points={polylinePoints}
        />

        {points2 &&
          (() => {
            // Consecutive non-null runs become line segments; a lone point stays a dot.
            const segments: { x: number; y: number }[][] = [];
            let run: { x: number; y: number }[] = [];
            points2.forEach((pt, idx) => {
              if (pt) {
                run.push({ x: toX(idx), y: toY(pt.value) });
              } else if (run.length > 0) {
                segments.push(run);
                run = [];
              }
            });
            if (run.length > 0) segments.push(run);
            return segments
              .filter((seg) => seg.length > 1)
              .map((seg, i) => (
                <polyline
                  key={`s2-line-${i}`}
                  fill="none"
                  stroke="var(--color-label-3)"
                  strokeWidth={2}
                  points={seg.map((p) => `${p.x},${p.y}`).join(" ")}
                />
              ));
          })()}

        {points2?.map((pt, idx) =>
          pt ? (
            <g key={`s2-${pt.date}-${idx}`}>
              <circle
                cx={toX(idx)}
                cy={toY(pt.value)}
                r={4}
                fill="var(--color-label-3)"
                stroke="var(--color-surface)"
                strokeWidth={1.5}
              >
                <title>{`${series2Label ?? "Second reading"}: ${pt.value} ${unit} on ${pt.date}`}</title>
              </circle>
            </g>
          ) : null,
        )}

        {points.map((pt, idx) => {
          const cx = toX(idx);
          const cy = toY(pt.value);
          const isAbnormal = pt.flag === "high" || pt.flag === "low";
          const isUnknown = pt.flag === "unknown";
          const flagLabel =
            pt.flag === "high" ? " (High)" : pt.flag === "low" ? " (Low)" : "";
          return (
            <g key={`${pt.date}-${idx}`}>
              <circle
                cx={cx}
                cy={cy}
                r={5}
                fill={isAbnormal ? "var(--color-danger)" : isUnknown ? "var(--color-label-3)" : "var(--color-accent)"}
                stroke="var(--color-surface)"
                strokeWidth={1.5}
              />
              <text
                x={cx}
                y={cy - 10}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill={isAbnormal ? "var(--color-danger-text)" : isUnknown ? "var(--color-label-2)" : "var(--color-accent-strong)"}
              >
                {pt.value}
                {flagLabel}
              </text>
              <text
                x={cx}
                y={padTop + plotH + 18}
                textAnchor="middle"
                fontSize="11"
                fill="var(--color-label-2)"
              >
                {pt.date}
              </text>
            </g>
          );
        })}
      </svg>
      </div>
    </div>
  );
}

export function AiSafetyBanner({
  feature,
  contextId,
  aiRunId,
}: {
  feature?: string;
  contextId?: string;
  aiRunId?: string | null;
}) {
  const reportMutation = useReportAiMistake();
  const { showToast } = useVyanaWeb();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const resolvedRunId = aiRunId ?? contextId;

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedRunId) return;
    try {
      await reportMutation.mutateAsync({
        ai_run_id: resolvedRunId,
        note: note.trim() || undefined,
      });
      setSubmitted(true);
      setOpen(false);
      setNote("");
      showToast("Thank you. AI feedback logged for clinical safety review.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not submit mistake report",
        "error"
      );
    }
  };

  return (
    <div className="rounded-row bg-fill px-3.5 py-2.5 text-[13px] text-label-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <Sparkles aria-hidden="true" className="h-4 w-4 text-accent" />
          <span>AI-generated, verify with your doctor</span>
        </div>
        {resolvedRunId ? (
          submitted ? (
            <span className="font-semibold text-ok">
              Mistake report recorded
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="rounded-full px-2 py-0.5 font-semibold text-accent-strong hover:bg-accent-soft"
            >
              Report a mistake
            </button>
          )
        ) : null}
      </div>

      {open && resolvedRunId && (
        <form onSubmit={handleReport} className="mt-2.5 flex flex-col sm:flex-row gap-2">
          <label htmlFor={`ai-report-${feature ?? resolvedRunId}`} className="sr-only">
            Describe the AI mistake
          </label>
          <input
            id={`ai-report-${feature ?? resolvedRunId}`}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What did the AI misread or get wrong?"
            className="h-10 flex-1 rounded-row border border-separator bg-surface px-3 text-[15px] text-label outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={reportMutation.isPending}
            className="h-10 rounded-full bg-accent px-4 text-[15px] font-semibold text-white hover:bg-accent-strong disabled:opacity-40"
          >
            {reportMutation.isPending ? "Sending…" : "Submit report"}
          </button>
        </form>
      )}
    </div>
  );
}

/** The site footer on every page; kept under this name so existing pages need no change (ADR-066). */
export function MedicalDisclaimerFooter() {
  return <SiteFooter />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading content"
      className="animate-pulse rounded-card bg-surface p-5 space-y-3"
    >
      <div className="h-4 w-2/5 rounded-full bg-fill-strong" />
      {Array.from({ length: lines }).map((_, idx) => (
        <div key={idx} className="h-3 w-full rounded-full bg-fill" />
      ))}
    </div>
  );
}

export function SkeletonList({
  count = 3,
  lines = 3,
}: {
  count?: number;
  lines?: number;
}) {
  return (
    <div className="space-y-4" role="status" aria-label="Loading list">
      {Array.from({ length: count }).map((_, idx) => (
        <SkeletonCard key={idx} lines={lines} />
      ))}
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div
      role="status"
      aria-label="Loading row"
      className="animate-pulse flex items-center justify-between gap-4 p-4 border-b border-separator"
    >
      <div className="h-4 w-1/3 rounded-full bg-fill-strong" />
      <div className="h-4 w-1/5 rounded-full bg-fill" />
      <div className="h-7 w-20 rounded-full bg-fill-strong" />
    </div>
  );
}
