"use client";

import React, { useState } from "react";
import {
  computeItemRefill,
  generateQrMatrix,
  parseCarePlanJson,
  useReportAiMistake,
} from "@vyana/shared";
import { useVyanaWeb } from "./providers";

export { computeItemRefill, generateQrMatrix, parseCarePlanJson };

export function QrCodeSvg({
  data,
  size = 200,
  label = "Medical ID QR Code",
}: {
  data: string;
  size?: number;
  label?: string;
}) {
  const grid = 25;
  const matrix = generateQrMatrix(data, grid);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${grid + 4} ${grid + 4}`}
      role="img"
      aria-label={label}
      className="rounded-xl bg-white p-2 border border-slate-200 shadow-sm"
    >
      <rect width={grid + 4} height={grid + 4} fill="#ffffff" />
      {matrix.map((row, r) =>
        row.map((cell, c) =>
          cell ? (
            <rect
              key={`${r}-${c}`}
              x={c + 2}
              y={r + 2}
              width={1}
              height={1}
              fill="#0f172a"
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
  flag?: "low" | "normal" | "high" | null;
}

export function TrendChartSvg({
  title,
  unit,
  points,
  refLow,
  refHigh,
}: {
  title: string;
  unit: string;
  points: TrendPoint[];
  refLow?: number | null;
  refHigh?: number | null;
}) {
  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
        No historical data points recorded for {title} yet.
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const allBounds = [
    ...values,
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
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            {title} Trend ({unit})
          </h4>
          {typeof refLow === "number" && typeof refHigh === "number" && (
            <p className="text-xs text-slate-500">
              Reference range: {refLow} – {refHigh} {unit} (shaded band)
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="inline-flex items-center gap-1 text-teal-700 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-600" /> Normal
          </span>
          <span className="inline-flex items-center gap-1 text-red-700 font-medium">
            <span className="h-2.5 w-2.5 rounded-full bg-red-600" /> High / Low
          </span>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${title} trend chart over ${points.length} measurements`}
        className="w-full h-44 overflow-visible"
      >
        {bandTop !== null && bandBottom !== null && bandBottom >= bandTop && (
          <rect
            x={padLeft}
            y={bandTop}
            width={plotW}
            height={Math.max(4, bandBottom - bandTop)}
            fill="#ccfbf1"
            opacity={0.55}
            rx={4}
          />
        )}

        <line
          x1={padLeft}
          y1={padTop + plotH}
          x2={padLeft + plotW}
          y2={padTop + plotH}
          stroke="#cbd5e1"
          strokeWidth={1}
        />

        <polyline
          fill="none"
          stroke="#0d9488"
          strokeWidth={2.5}
          points={polylinePoints}
        />

        {points.map((pt, idx) => {
          const cx = toX(idx);
          const cy = toY(pt.value);
          const isAbnormal = pt.flag === "high" || pt.flag === "low";
          const flagLabel =
            pt.flag === "high" ? " (High)" : pt.flag === "low" ? " (Low)" : "";
          return (
            <g key={`${pt.date}-${idx}`}>
              <circle
                cx={cx}
                cy={cy}
                r={5}
                fill={isAbnormal ? "#dc2626" : "#0d9488"}
                stroke="#ffffff"
                strokeWidth={1.5}
              />
              <text
                x={cx}
                y={cy - 10}
                textAnchor="middle"
                fontSize="10"
                fontWeight="600"
                fill={isAbnormal ? "#b91c1c" : "#0f766e"}
              >
                {pt.value}
                {flagLabel}
              </text>
              <text
                x={cx}
                y={padTop + plotH + 18}
                textAnchor="middle"
                fontSize="10"
                fill="#475569"
              >
                {pt.date}
              </text>
            </g>
          );
        })}
      </svg>
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
    <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-3.5 py-2.5 text-xs text-amber-950">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-medium">
          <span
            aria-hidden="true"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-200 text-amber-900 font-bold"
          >
            !
          </span>
          <span>AI-generated, verify with your doctor</span>
        </div>
        {resolvedRunId ? (
          submitted ? (
            <span className="text-teal-800 font-semibold">
              Mistake report recorded
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="underline font-semibold text-amber-900 hover:text-amber-700 focus:outline-none focus:ring-2 focus:ring-amber-500 rounded px-1"
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
            className="flex-1 rounded-lg border border-amber-300 bg-white px-2.5 py-1.5 text-xs text-slate-900"
          />
          <button
            type="submit"
            disabled={reportMutation.isPending}
            className="rounded-lg bg-amber-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-900"
          >
            {reportMutation.isPending ? "Sending…" : "Submit report"}
          </button>
        </form>
      )}
    </div>
  );
}

export function MedicalDisclaimerFooter() {
  return (
    <footer className="mt-auto border-t border-slate-200 bg-white py-5 px-4 text-xs text-slate-600">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <p className="font-medium text-slate-700">
          Vyana · व्यान — Not a substitute for professional medical advice. Always verify AI-assisted summaries and drug information with a registered medical practitioner.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="tel:108"
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 font-semibold text-white hover:bg-red-700"
          >
            Emergency Ambulance: 108
          </a>
          <a
            href="tel:112"
            className="inline-flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 font-semibold text-red-800 hover:bg-red-100"
          >
            National Emergency: 112
          </a>
        </div>
      </div>
    </footer>
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading content"
      className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 space-y-3"
    >
      <div className="h-4 w-2/5 rounded bg-slate-200" />
      {Array.from({ length: lines }).map((_, idx) => (
        <div key={idx} className="h-3 w-full rounded bg-slate-100" />
      ))}
    </div>
  );
}
