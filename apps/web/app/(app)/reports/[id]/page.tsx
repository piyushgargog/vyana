"use client";

import React, { use } from "react";
import { useRouter } from "next/navigation";
import {
  labSearchLinks,
  useLabReport,
  useLabValueHistory,
  type DbLabValue,
} from "@vyana/shared";
import {
  AiSafetyBanner,
  TrendChartSvg,
  type TrendPoint,
} from "@/components/ui-primitives";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  LargeTitle,
  Pill,
  Reveal,
  SkeletonLine,
} from "@/components/ui";
import {
  ArrowLeft,
  ExternalLink,
  FileWarning,
  FlaskConical,
  TrendingUp,
} from "lucide-react";

/** Look a test up on the lab sites themselves (v1.2): a search where the lab has one, its home page where it does not. */
function LabLookupLinks({ testName }: { testName: string }) {
  const links = labSearchLinks(testName);
  if (links.length === 0) return null;
  return (
    <div className="mt-3 border-t border-separator pt-3">
      <p className="text-[13px] font-medium text-label-3">
        Look up this test
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {links.map((link) => (
          <ButtonLink
            key={link.id}
            variant="plain"
            size="sm"
            className="min-h-[44px]"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={
              link.searchesTest
                ? `Search on ${link.name} for ${testName}`
                : `Open ${link.name}`
            }
            icon={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
          >
            {link.searchesTest ? `Search on ${link.name}` : `Open ${link.name}`}
          </ButtonLink>
        ))}
      </div>
    </div>
  );
}

function flagTone(flag: string): "danger" | "warn" | "ok" | "neutral" {
  if (flag === "high") return "danger";
  if (flag === "low") return "warn";
  if (flag === "normal") return "ok";
  return "neutral";
}

function flagLabel(flag: string): string {
  if (flag === "high") return "High";
  if (flag === "low") return "Low";
  if (flag === "normal") return "Normal";
  return "No range";
}

function refRangeText(v: {
  ref_low: number | null;
  ref_high: number | null;
  unit: string | null;
}): string {
  const unit = v.unit ?? "";
  if (v.ref_low !== null && v.ref_high !== null)
    return `${v.ref_low} – ${v.ref_high} ${unit}`.trim();
  if (v.ref_high !== null) return `< ${v.ref_high} ${unit}`.trim();
  if (v.ref_low !== null) return `> ${v.ref_low} ${unit}`.trim();
  return "No range on the report";
}

function toTrendFlag(flag: string): TrendPoint["flag"] {
  return flag === "low" || flag === "normal" || flag === "high" ? flag : null;
}

/** One test's history as a trend chart; renders nothing until it has a real trend. */
function TestTrend({
  testName,
  unit,
  refLow,
  refHigh,
}: {
  testName: string;
  unit: string;
  refLow: number | null;
  refHigh: number | null;
}) {
  const { data: history, isLoading } = useLabValueHistory(testName);

  if (isLoading) {
    return (
      <div className="rounded-tile bg-surface p-4">
        <SkeletonLine className="mb-2 h-4 w-40" />
        <SkeletonLine className="h-24" />
      </div>
    );
  }

  const points: TrendPoint[] = (history ?? [])
    .filter((h: DbLabValue) => h.value !== null)
    .map((h: DbLabValue) => ({
      date: h.measured_on ? h.measured_on.slice(5, 10) : "",
      value: h.value as number,
      flag: toTrendFlag(h.flag),
    }));

  // A trend needs at least two measurements.
  if (points.length < 2) return null;

  return (
    <TrendChartSvg
      title={testName}
      unit={unit}
      points={points}
      refLow={refLow}
      refHigh={refHigh}
    />
  );
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(id: unknown): boolean {
  return typeof id === "string" && UUID_REGEX.test(id);
}

export function isInvalidUuidError(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.toLowerCase().includes("invalid input syntax for type uuid") ||
    msg.includes("22P02")
  );
}

export default function LabReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const validUuid = isValidUuid(id);
  const { data: report, isLoading, isError, error, refetch } = useLabReport(
    validUuid ? id : undefined
  );

  if (!validUuid) {
    return (
      <div className="space-y-6">
        <LargeTitle
          eyebrow="Lab reports"
          title="Lab report"
          actions={
            <Button variant="secondary" onClick={() => router.back()}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back
            </Button>
          }
        />
        <EmptyState
          icon={<FileWarning aria-hidden="true" />}
          title="Report not found"
          body="This report may have been deleted, or the link is wrong."
          action={
            <Button variant="secondary" onClick={() => router.back()}>
              Go back
            </Button>
          }
        />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6" aria-live="polite" aria-busy="true">
        <div className="space-y-2">
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-9 w-2/3" />
          <SkeletonLine className="h-5 w-40" />
        </div>
        <div className="rounded-card bg-surface p-5">
          <SkeletonLine className="mb-3 h-5 w-48" />
          <SkeletonLine className="mb-2 h-4 w-full" />
          <SkeletonLine className="mb-2 h-4 w-full" />
          <SkeletonLine className="h-4 w-2/3" />
        </div>
        <div className="rounded-card bg-surface p-5">
          <SkeletonLine className="mb-3 h-5 w-32" />
          <SkeletonLine className="mb-2 h-12 w-full" />
          <SkeletonLine className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (isError) {
    if (isInvalidUuidError(error)) {
      return (
        <div className="space-y-6">
          <LargeTitle
            eyebrow="Lab reports"
            title="Lab report"
            actions={
              <Button variant="secondary" onClick={() => router.back()}>
                <ArrowLeft aria-hidden="true" className="h-4 w-4" />
                Back
              </Button>
            }
          />
          <EmptyState
            icon={<FileWarning aria-hidden="true" />}
            title="Report not found"
            body="This report may have been deleted, or the link is wrong."
            action={
              <Button variant="secondary" onClick={() => router.back()}>
                Go back
              </Button>
            }
          />
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <LargeTitle
          eyebrow="Lab reports"
          title="Lab report"
          actions={
            <Button variant="secondary" onClick={() => router.back()}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back
            </Button>
          }
        />
        <Card>
          <div className="space-y-3 py-2 text-center">
            <p className="text-[17px] font-semibold text-label">
              Could not load this report
            </p>
            <p className="text-[15px] text-label-2">
              Something went wrong while loading this report. Please try again.
            </p>
            <Button variant="secondary" onClick={() => refetch()}>
              Try again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="space-y-6">
        <LargeTitle
          eyebrow="Lab reports"
          title="Lab report"
          actions={
            <Button variant="secondary" onClick={() => router.back()}>
              <ArrowLeft aria-hidden="true" className="h-4 w-4" />
              Back
            </Button>
          }
        />
        <EmptyState
          icon={<FileWarning aria-hidden="true" />}
          title="Report not found"
          body="This report may have been deleted, or the link is wrong."
          action={
            <Button variant="secondary" onClick={() => router.back()}>
              Go back
            </Button>
          }
        />
      </div>
    );
  }

  const values = report.lab_values ?? [];

  return (
    <div className="space-y-6">
      <LargeTitle
        eyebrow="Lab reports"
        title={report.lab_name || "Lab report"}
        subtitle={report.report_date ? `Tested on ${report.report_date}` : undefined}
        actions={
          <Button variant="secondary" onClick={() => router.back()}>
            <ArrowLeft aria-hidden="true" className="h-4 w-4" />
            Back
          </Button>
        }
      />

      {report.summary ? (
        <Reveal>
          <Card>
            <CardHeader title="What your report says" />
            <p className="mt-3 text-[17px] leading-relaxed text-label-2">
              {report.summary}
            </p>
          </Card>
        </Reveal>
      ) : null}

      <AiSafetyBanner feature="lab_report" />

      <div>
        <h2 className="mb-3 text-xl font-semibold text-label">
          Test results ({values.length})
        </h2>
        {values.length === 0 ? (
          <EmptyState
            icon={<FlaskConical aria-hidden="true" />}
            title="No values in this report"
            body="No test values were saved for this report."
          />
        ) : (
          <div className="space-y-3">
            {values.map((v) => {
              const abnormal = v.flag === "high" || v.flag === "low";
              return (
                <Reveal key={v.id} delay={0}>
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[17px] font-semibold text-label">
                          {v.test_name}
                        </h3>
                        <p className="mt-1 text-[13px] text-label-3">
                          Reference: {refRangeText(v)}
                        </p>
                      </div>
                      <Pill tone={flagTone(v.flag)}>{flagLabel(v.flag)}</Pill>
                    </div>
                    <p
                      className={
                        abnormal
                          ? "mt-3 text-[20px] font-bold text-danger-text"
                          : "mt-3 text-[20px] font-bold text-label"
                      }
                    >
                      {v.value !== null ? v.value : (v.value_text || "—")}{" "}
                      <span className="text-[15px] font-medium text-label-3">
                        {v.unit || ""}
                      </span>
                    </p>
                    <LabLookupLinks testName={v.test_name} />
                  </Card>
                </Reveal>
              );
            })}
          </div>
        )}
      </div>

      {values.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp aria-hidden="true" className="h-5 w-5 text-accent" />
            <h2 className="text-xl font-semibold text-label">
              How your results change
            </h2>
          </div>
          <p className="mb-3 text-[15px] text-label-2">
            Charts appear here once a test has been measured more than once.
          </p>
          <div className="space-y-4">
            {values.map((v) => (
              <TestTrend
                key={v.id}
                testName={v.test_name}
                unit={v.unit ?? ""}
                refLow={v.ref_low}
                refHigh={v.ref_high}
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
