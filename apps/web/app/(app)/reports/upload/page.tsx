"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  uploadFile,
  useAnalyzeReport,
  useCorrectLabValue,
  type LabValue,
  type ReportAnalyzeRes,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { AiSafetyBanner } from "@/components/ui-primitives";
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  LargeTitle,
  Pill,
  Reveal,
  Sheet,
  SkeletonLine,
} from "@/components/ui";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  FlaskConical,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

type Step = "upload" | "review";

function flagTone(flag: LabValue["flag"]): "danger" | "warn" | "ok" | "neutral" {
  if (flag === "high") return "danger";
  if (flag === "low") return "warn";
  if (flag === "normal") return "ok";
  return "neutral";
}

function flagLabel(flag: LabValue["flag"]): string {
  if (flag === "high") return "High";
  if (flag === "low") return "Low";
  if (flag === "normal") return "Normal";
  return "No range";
}

function refRangeText(val: LabValue): string {
  const unit = val.unit ?? "";
  if (val.ref_low !== null && val.ref_high !== null)
    return `${val.ref_low} – ${val.ref_high} ${unit}`.trim();
  if (val.ref_high !== null) return `< ${val.ref_high} ${unit}`.trim();
  if (val.ref_low !== null) return `> ${val.ref_low} ${unit}`.trim();
  return "No range on the report";
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportUploadPage() {
  const router = useRouter();
  const { supabase, showToast } = useVyanaWeb();
  const analyzeMutation = useAnalyzeReport();
  const correctMutation = useCorrectLabValue();

  const [step, setStep] = useState<Step>("upload");
  const [reportDate, setReportDate] = useState(todayIso());
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [analyzedData, setAnalyzedData] = useState<ReportAnalyzeRes | null>(null);
  const [editedValues, setEditedValues] = useState<LabValue[]>([]);
  // What the patient typed per row, until it is saved through the server (ADR-062).
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [savingIdx, setSavingIdx] = useState<number | null>(null);
  const [showDiscardSheet, setShowDiscardSheet] = useState(false);

  const busy = isUploading || analyzeMutation.isPending;

  const handleUploadAnalyze = async () => {
    if (!file) {
      showToast("Choose a photo or PDF of your lab report first", "warning");
      return;
    }
    setUploadError(null);
    setIsUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "";
      const targetPath = await uploadFile(supabase, "lab-reports", file, ext);
      const res = await analyzeMutation.mutateAsync({
        file_path: targetPath,
        report_date: reportDate || undefined,
      });
      setAnalyzedData(res);
      setEditedValues(res.values);
      setDrafts({});
      setStep("review");
      showToast("Lab report analyzed successfully", "success");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Report analysis failed";
      setUploadError(message);
      showToast(message, "error");
    } finally {
      setIsUploading(false);
    }
  };

  // A corrected value is saved on the server, which recomputes the flag and the summary.
  const handleSaveValue = async (index: number) => {
    const val = editedValues[index];
    const draft = (drafts[index] ?? "").trim();
    const parsed = Number(draft);
    if (!val?.id) {
      showToast(
        "This value cannot be corrected here. Open the report again.",
        "warning"
      );
      return;
    }
    if (!draft || !Number.isFinite(parsed)) {
      showToast("Enter the number exactly as it is written on the report", "warning");
      return;
    }
    setSavingIdx(index);
    try {
      const res = await correctMutation.mutateAsync({
        value_id: val.id,
        value: parsed,
      });
      setEditedValues((prev) =>
        prev.map((v, i) => (i === index ? { ...v, ...res.value } : v))
      );
      setAnalyzedData((prev) =>
        prev
          ? {
              ...prev,
              summary: res.summary,
              follow_up_tests: res.follow_up_tests,
            }
          : prev
      );
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[index];
        return next;
      });
      showToast(`${val.test_name} saved`, "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not save this value",
        "error"
      );
    } finally {
      setSavingIdx(null);
    }
  };

  const handleDiscard = () => {
    setShowDiscardSheet(false);
    setStep("upload");
    setFile(null);
    setAnalyzedData(null);
    setEditedValues([]);
    setDrafts({});
    setUploadError(null);
  };

  const handleDone = () => {
    if (!analyzedData) return;
    showToast(
      `Lab report analyzed with ${editedValues.length} extracted values`,
      "success"
    );
    router.push(`/reports/${analyzedData.report_id}`);
  };

  return (
    <div className="space-y-6">
      <LargeTitle
        eyebrow="Lab reports"
        title="Upload lab report"
        subtitle="We read the test values from your report, check them against the reference ranges, and explain them in plain words."
      />

      {step === "upload" ? (
        <Reveal>
          <Card>
            <CardHeader
              title="Choose your report"
              trailing={
                <span className="text-[13px] text-label-3">JPG, PNG or PDF</span>
              }
            />
            <div className="mt-4 space-y-4">
              <Field
                label="Report date"
                type="date"
                aria-label="Report date"
                value={reportDate}
                max={todayIso()}
                onChange={(e) => setReportDate(e.target.value)}
                hint="The date printed on the report."
              />

              <div>
                <label
                  htmlFor="report-file"
                  className="flex min-h-[44px] cursor-pointer flex-col items-center justify-center gap-2 rounded-tile border-2 border-dashed border-separator bg-canvas px-4 py-8 text-center transition-colors hover:border-accent"
                >
                  <FileUp aria-hidden="true" className="h-6 w-6 text-accent" />
                  <span className="text-[15px] font-semibold text-label">
                    {file ? file.name : "Choose a photo or PDF"}
                  </span>
                  <span className="text-[13px] text-label-3">
                    {file
                      ? "Tap to choose a different file"
                      : "Take a photo of your lab sheet or pick a file"}
                  </span>
                </label>
                <input
                  id="report-file"
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setUploadError(null);
                  }}
                />
              </div>

              {busy ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="space-y-3 rounded-tile bg-fill p-4"
                >
                  <p className="text-[15px] font-semibold text-label">
                    {isUploading
                      ? "Uploading report…"
                      : "Reading lab values…"}
                  </p>
                  <SkeletonLine className="h-3" />
                  <SkeletonLine className="h-3 w-3/4" />
                  <p className="text-[13px] text-label-3">
                    This can take up to a minute. Please keep this page open.
                  </p>
                </div>
              ) : (
                <Button
                  variant="primary"
                  size="lg"
                  className="w-full"
                  onClick={handleUploadAnalyze}
                  disabled={!file}
                >
                  Upload and analyze
                </Button>
              )}

              {uploadError && !busy ? (
                <div
                  role="alert"
                  className="space-y-3 rounded-tile border border-separator bg-surface p-4"
                >
                  <p className="text-[15px] font-semibold text-label">
                    The upload did not finish
                  </p>
                  <p className="text-[15px] text-label-2">{uploadError}</p>
                  <Button
                    variant="secondary"
                    onClick={handleUploadAnalyze}
                    disabled={!file}
                  >
                    Try again
                  </Button>
                </div>
              ) : null}
            </div>
          </Card>

          <Card className="mt-4">
            <div className="flex items-start gap-3">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-accent"
              />
              <div className="space-y-1">
                <p className="text-[15px] font-semibold text-label">
                  How we handle your report
                </p>
                <ul className="list-disc space-y-1 pl-5 text-[15px] leading-relaxed text-label-2">
                  <li>Values and units are read exactly as written on the document.</li>
                  <li>High / Low / Normal flags are worked out by code, not guessed.</li>
                  <li>The summary restates your numbers in plain words. It does not diagnose.</li>
                </ul>
              </div>
            </div>
          </Card>
        </Reveal>
      ) : (
        <div className="space-y-4">
          <Reveal>
            <Card>
              <div className="flex items-center gap-2">
                <FlaskConical
                  aria-hidden="true"
                  className="h-5 w-5 text-accent"
                />
                <h2 className="text-xl font-semibold text-label">
                  Review your lab values
                </h2>
              </div>
              <p className="mt-2 text-[15px] leading-relaxed text-label-2">
                Check each value against your paper report. If a number is
                wrong, type the correct one and tap Save — the flag is worked
                out again on our server.
              </p>
            </Card>
          </Reveal>

          <AiSafetyBanner
            feature="reports_analyze"
            aiRunId={analyzedData?.ai?.run_id}
          />

          {analyzedData?.summary ? (
            <Reveal>
              <Card>
                <CardHeader title="What your report says" />
                <p className="mt-3 text-[17px] leading-relaxed text-label-2">
                  {analyzedData.summary}
                </p>
              </Card>
            </Reveal>
          ) : null}

          {analyzedData?.follow_up_tests &&
          analyzedData.follow_up_tests.length > 0 ? (
            <Reveal>
              <Card>
                <CardHeader title="Tests your doctor may suggest next" />
                <div className="mt-3 flex flex-wrap gap-2">
                  {analyzedData.follow_up_tests.map((test) => (
                    <Pill key={test} tone="accent">
                      {test}
                    </Pill>
                  ))}
                </div>
              </Card>
            </Reveal>
          ) : null}

          <h2 className="text-xl font-semibold text-label">
            Test values ({editedValues.length})
          </h2>

          {editedValues.length === 0 ? (
            <EmptyState
              icon={<FlaskConical aria-hidden="true" />}
              title="No values found"
              body="We could not read any test values from this file. Try a clearer photo or a different file."
              action={
                <Button variant="secondary" onClick={handleDiscard}>
                  Try another file
                </Button>
              }
            />
          ) : (
            <div className="space-y-3">
              {editedValues.map((val, idx) => {
                const draft = drafts[idx];
                const shown =
                  draft ?? (val.value !== null ? String(val.value) : (val.value_text ?? ""));
                // Only numbers read from the report can be corrected here (ADR-062).
                const correctable = val.value_text === null;
                return (
                  <Reveal key={`${val.test_name}-${idx}`} delay={Math.min(idx * 0.04, 0.3)}>
                    <Card>
                      {val.needs_review ? (
                        <p className="mb-3 flex items-start gap-2 rounded-row bg-warn-soft p-3 text-[15px] font-medium text-warn">
                          <AlertTriangle
                            aria-hidden="true"
                            className="mt-0.5 h-4 w-4 shrink-0"
                          />
                          <span>
                            Needs review:{" "}
                            {val.evidence || "Check this value on your report."}
                          </span>
                        </p>
                      ) : null}

                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="text-[17px] font-semibold text-label">
                            {val.test_name}
                          </h3>
                          <p className="mt-1 text-[13px] text-label-3">
                            Reference: {refRangeText(val)}
                          </p>
                        </div>
                        <Pill tone={flagTone(val.flag)}>{flagLabel(val.flag)}</Pill>
                      </div>

                      <div className="mt-4 flex items-end gap-2">
                        <label
                          htmlFor={`correct-${idx}`}
                          className="min-w-0 flex-1"
                        >
                          <span className="mb-1.5 block px-1 text-[15px] font-medium text-label">
                            {val.corrected ? "Corrected value" : "Measured value"}
                          </span>
                          <div className="flex items-center gap-2">
                            <input
                              id={`correct-${idx}`}
                              value={shown}
                              onChange={(e) =>
                                setDrafts((prev) => ({
                                  ...prev,
                                  [idx]: e.target.value,
                                }))
                              }
                              inputMode="decimal"
                              disabled={!correctable || savingIdx !== null}
                              aria-label={`${val.test_name} value`}
                              className="h-12 min-w-0 flex-1 rounded-row border border-transparent bg-fill px-4 text-[17px] font-semibold text-label outline-none transition-colors focus:border-accent focus:bg-surface disabled:opacity-60"
                            />
                            <span className="shrink-0 text-[15px] text-label-3">
                              {val.unit || ""}
                            </span>
                          </div>
                        </label>
                        {draft !== undefined && (
                          <Button
                            variant="secondary"
                            size="sm"
                            className="mb-0.5 min-h-[44px] shrink-0"
                            disabled={savingIdx !== null}
                            onClick={() => handleSaveValue(idx)}
                          >
                            {savingIdx === idx ? "Saving…" : "Save"}
                          </Button>
                        )}
                      </div>
                    </Card>
                  </Reveal>
                );
              })}
            </div>
          )}

          <div className="flex flex-col gap-3 pt-2">
            <Button variant="primary" size="lg" onClick={handleDone}>
              <CheckCircle2 aria-hidden="true" className="h-5 w-5" />
              Done — view report
            </Button>
            <Button
              variant="plain"
              onClick={() => setShowDiscardSheet(true)}
            >
              <RotateCcw aria-hidden="true" className="h-4 w-4" />
              Upload a different file
            </Button>
          </div>
        </div>
      )}

      <Sheet
        open={showDiscardSheet}
        onClose={() => setShowDiscardSheet(false)}
        title="Upload a different file?"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowDiscardSheet(false)}
            >
              Keep reviewing
            </Button>
            <Button variant="destructive" onClick={handleDiscard}>
              Start over
            </Button>
          </div>
        }
      >
        <p className="text-[15px] leading-relaxed text-label-2">
          The report you just reviewed stays saved in your health records. You
          can upload and analyze a different file.
        </p>
      </Sheet>
    </div>
  );
}
