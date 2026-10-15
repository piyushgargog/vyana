"use client";

import React, { useRef, useState } from "react";
import {
  DEFAULT_TIMES,
  uploadFile,
  useCheckInteractions,
  useExtractPrescription,
  type FrequencyType,
  type InteractionsRes,
  type PrescriptionExtractRes,
  type PrescriptionItem,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import {
  AiSafetyBanner,
  MedicalDisclaimerFooter,
} from "@/components/ui-primitives";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  Field,
  LargeTitle,
  Pill,
  Reveal,
  SelectField,
  Sheet,
} from "@/components/ui";
import {
  AlertTriangle,
  CheckCircle2,
  FileUp,
  Loader2,
  Quote,
  ShieldCheck,
  Trash2,
} from "lucide-react";

const FREQUENCIES: FrequencyType[] = [
  "OD",
  "BD",
  "TDS",
  "QID",
  "HS",
  "SOS",
  "custom",
];

const NOT_FOUND = "Not found on the prescription";

function extFor(file: File): string | null {
  if (file.type === "application/pdf") return "pdf";
  if (file.type === "image/png") return "png";
  if (file.type === "image/jpeg" || file.type === "image/jpg") return "jpg";
  const match = /\.([a-z0-9]+)$/i.exec(file.name);
  const ext = match?.[1]?.toLowerCase();
  return ext === "pdf" || ext === "png" || ext === "jpg" || ext === "jpeg"
    ? ext
    : null;
}

export default function PrescriptionScanPage() {
  const { supabase, showToast } = useVyanaWeb();
  const extractMutation = useExtractPrescription();
  const checkInteractionsMutation = useCheckInteractions();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<"upload" | "review">("upload");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<PrescriptionExtractRes | null>(
    null
  );
  const [items, setItems] = useState<PrescriptionItem[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saved, setSaved] = useState<{
    count: number;
    interactions: InteractionsRes | null;
    prescriptionId: string;
  } | null>(null);

  const busy = isUploading || extractMutation.isPending;

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    const ext = extFor(file);
    if (!ext) {
      setError("That file type is not supported. Please choose a photo (JPG or PNG) or a PDF.");
      return;
    }
    setError(null);
    setIsUploading(true);
    try {
      const path = await uploadFile(supabase, "prescriptions", file, ext);
      const res = await extractMutation.mutateAsync({ file_path: path });
      setExtracted(res);
      setItems(res.items);
      setPhase("review");
      showToast("Prescription read. Please check every medicine.", "success");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We could not read that prescription. Please try again."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleFieldChange = (
    index: number,
    field: "strength" | "dose" | "frequency" | "duration_days",
    value: string
  ) => {
    setItems((prev) => {
      const copy = [...prev];
      const current = copy[index];
      if (!current) return prev;
      if (field === "duration_days") {
        const n = value === "" ? null : Number.parseInt(value, 10);
        copy[index] = {
          ...current,
          duration_days: Number.isNaN(n) ? null : n,
        };
        return copy;
      }
      if (field === "frequency") {
        const freq = value as FrequencyType;
        copy[index] = {
          ...current,
          frequency: freq,
          times: DEFAULT_TIMES[freq] ?? [],
        };
        return copy;
      }
      copy[index] = { ...current, [field]: value };
      return copy;
    });
  };

  const handleRemove = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (items.length === 0) {
      showToast("There are no medicines left to save.", "warning");
      return;
    }
    const prescriptionId = extracted?.prescription_id;
    if (!prescriptionId) {
      showToast("Something went wrong. Please scan again.", "error");
      return;
    }
    setIsSaving(true);
    try {
      // 1. Delete items the patient removed during review (by id).
      const keptIds = new Set(items.map((i) => i.id));
      const removedIds = (extracted?.items ?? [])
        .filter((i) => !keptIds.has(i.id))
        .map((i) => i.id);
      if (removedIds.length > 0) {
        const { error: delErr } = await supabase
          .from("prescription_items")
          .delete()
          .in("id", removedIds);
        if (delErr) throw new Error(delErr.message);
      }

      // 2. Save the patient's verified values (by id, no invented defaults).
      for (const item of items) {
        const freq: FrequencyType =
          item.frequency in DEFAULT_TIMES ? item.frequency : "custom";
        const times =
          item.times && item.times.length > 0
            ? item.times
            : (DEFAULT_TIMES[freq] ?? []);
        const { error: updateErr } = await supabase
          .from("prescription_items")
          .update({
            medicine_name: item.medicine_name.trim(),
            strength: item.strength?.trim() || null,
            dose: item.dose?.trim() || null,
            form: item.form,
            frequency: freq,
            times,
            with_food: item.with_food,
            instructions: item.instructions?.trim() || null,
            duration_days: item.duration_days ?? null,
            start_date: item.start_date,
            end_date: item.end_date || null,
          })
          .eq("id", item.id);
        if (updateErr) throw new Error(updateErr.message);
      }

      // 3. Check drug interactions for the new prescription (best effort).
      let interactions: InteractionsRes | null = null;
      try {
        interactions = await checkInteractionsMutation.mutateAsync({
          prescription_id: prescriptionId,
        });
      } catch {
        interactions = null;
      }

      setSaved({ count: items.length, interactions, prescriptionId });
      showToast(
        `Saved ${items.length} medicine${items.length === 1 ? "" : "s"}.`,
        "success"
      );
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Could not save the medicines.",
        "error"
      );
      setSheetOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <LargeTitle
        eyebrow="Prescriptions"
        title={phase === "upload" ? "Scan prescription" : "Check the medicines"}
        subtitle={
          phase === "upload"
            ? "Upload a photo or PDF of your paper prescription. The app reads the medicines — you verify every field before saving."
            : "The app read your prescription. Please check each medicine carefully before saving."
        }
      />

      {phase === "upload" ? (
        <Reveal>
          <Card>
            <CardHeader
              title="Upload prescription"
              trailing="JPG, PNG or PDF"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*,.pdf"
              aria-label="Choose a prescription photo or PDF"
              className="sr-only"
              onChange={(e) => {
                void handleFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {busy ? (
              <div
                role="status"
                className="flex min-h-44 items-center justify-center gap-3 rounded-tile bg-accent-soft px-5 py-8"
              >
                <Loader2
                  aria-hidden="true"
                  className="h-6 w-6 animate-spin text-accent"
                />
                <p className="text-[17px] font-semibold text-accent-strong">
                  {isUploading
                    ? "Uploading your file…"
                    : "Reading the prescription…"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <Button
                  size="lg"
                  className="w-full"
                  icon={<FileUp aria-hidden="true" className="h-5 w-5" />}
                  onClick={() => fileRef.current?.click()}
                >
                  Choose a photo or PDF
                </Button>
                <p className="text-center text-[15px] text-label-3">
                  Take a clear photo of the paper prescription, or pick a
                  digital copy from your device.
                </p>
              </div>
            )}
            {error && (
              <div className="mt-4 rounded-tile bg-danger-soft p-4">
                <p className="text-[15px] font-semibold text-danger-text">
                  {error}
                </p>
                <Button
                  variant="secondary"
                  className="mt-3"
                  onClick={() => {
                    setError(null);
                    fileRef.current?.click();
                  }}
                >
                  Try again
                </Button>
              </div>
            )}
          </Card>

          <Card className="mt-4">
            <div className="flex items-start gap-3">
              <ShieldCheck
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 text-accent"
              />
              <div className="space-y-1">
                <p className="text-[17px] font-semibold text-label">
                  Nothing is saved until you confirm
                </p>
                <p className="text-[15px] leading-relaxed text-label-2">
                  Doses and timings come only from your prescription. Fields
                  the app could not read clearly are flagged for your review,
                  and no reminders are set until you save.
                </p>
              </div>
            </div>
          </Card>
        </Reveal>
      ) : (
        <div className="space-y-4">
          <AiSafetyBanner
            feature="prescriptions_extract"
            aiRunId={extracted?.ai?.run_id}
          />

          {extracted && extracted.warnings.length > 0 && (
            <Reveal>
              <Card>
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-warn"
                  />
                  <div className="space-y-1.5">
                    <p className="text-[17px] font-semibold text-label">
                      Needs your attention
                    </p>
                    <ul className="list-disc space-y-1 pl-5 text-[15px] text-label-2">
                      {extracted.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>
            </Reveal>
          )}

          <Reveal>
            <Card>
              <CardHeader title="Prescription details" />
              <dl className="divide-y divide-separator">
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-[15px] text-label-3">Doctor</dt>
                  <dd className="text-right text-[17px] font-semibold text-label">
                    {extracted?.doctor_name || NOT_FOUND}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-[15px] text-label-3">Diagnosis</dt>
                  <dd className="text-right text-[17px] font-semibold text-label">
                    {extracted?.diagnosis || NOT_FOUND}
                  </dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 py-2.5">
                  <dt className="text-[15px] text-label-3">Issued on</dt>
                  <dd className="text-right text-[17px] font-semibold text-label">
                    {extracted?.issued_on || NOT_FOUND}
                  </dd>
                </div>
              </dl>
            </Card>
          </Reveal>

          <h2 className="text-xl font-semibold text-label">
            Medicines ({items.length})
          </h2>

          {items.length === 0 ? (
            <EmptyState
              icon={<FileUp aria-hidden="true" />}
              title="No medicines left"
              body="You removed every item. Scan the prescription again to start over."
              action={
                <Button
                  variant="secondary"
                  onClick={() => {
                    setPhase("upload");
                    setExtracted(null);
                    setItems([]);
                  }}
                >
                  Scan again
                </Button>
              }
            />
          ) : (
            items.map((item, idx) => (
              <Reveal key={item.id} delay={Math.min(idx * 0.05, 0.3)}>
                <Card className={item.needs_review ? "border-2 border-warn" : undefined}>
                  {item.needs_review && (
                    <div className="mb-3 space-y-1.5 rounded-tile bg-warn-soft p-3">
                      <Pill tone="warn" icon={<AlertTriangle aria-hidden="true" />}>
                        Needs check
                      </Pill>
                      {item.evidence && (
                        <p className="flex items-start gap-1.5 text-[13px] italic text-label-2">
                          <Quote
                            aria-hidden="true"
                            className="mt-0.5 h-3.5 w-3.5 shrink-0"
                          />
                          <span>From your prescription: “{item.evidence}”</span>
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[17px] font-semibold text-label">
                        {item.medicine_name}
                      </p>
                      <p className="mt-0.5 text-[13px] font-semibold uppercase tracking-wide text-accent-strong">
                        {item.form}
                      </p>
                    </div>
                    <Button
                      variant="destructive"
                      aria-label={`Remove ${item.medicine_name}`}
                      icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                      onClick={() => handleRemove(idx)}
                    >
                      Remove
                    </Button>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field
                      label="Strength"
                      value={item.strength ?? ""}
                      placeholder="e.g. 500 mg"
                      onChange={(e) =>
                        handleFieldChange(idx, "strength", e.target.value)
                      }
                    />
                    <Field
                      label="Dose"
                      value={item.dose ?? ""}
                      placeholder="e.g. 1 tablet"
                      onChange={(e) =>
                        handleFieldChange(idx, "dose", e.target.value)
                      }
                    />
                    <SelectField
                      label="How often"
                      value={item.frequency}
                      onChange={(e) =>
                        handleFieldChange(idx, "frequency", e.target.value)
                      }
                    >
                      {FREQUENCIES.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </SelectField>
                    <Field
                      label="Days"
                      type="number"
                      min={1}
                      value={
                        item.duration_days === null ||
                        item.duration_days === undefined
                          ? ""
                          : String(item.duration_days)
                      }
                      placeholder="e.g. 30"
                      onChange={(e) =>
                        handleFieldChange(idx, "duration_days", e.target.value)
                      }
                    />
                  </div>

                  {item.instructions && (
                    <p className="mt-3 text-[15px] italic text-label-2">
                      Note: {item.instructions}
                    </p>
                  )}
                </Card>
              </Reveal>
            ))
          )}

          {items.length > 0 && (
            <div className="pb-2">
              <Button
                size="lg"
                className="w-full"
                icon={<CheckCircle2 aria-hidden="true" className="h-5 w-5" />}
                onClick={() => {
                  setSaved(null);
                  setSheetOpen(true);
                }}
              >
                Confirm and save
              </Button>
            </div>
          )}
        </div>
      )}

      <Sheet
        open={sheetOpen}
        onClose={() => {
          if (!isSaving) setSheetOpen(false);
        }}
        title={saved ? "Saved" : "Confirm medicines"}
        footer={
          saved ? (
            <ButtonLink
              href={`/prescriptions/${saved.prescriptionId}`}
              className="w-full"
            >
              View prescription
            </ButtonLink>
          ) : (
            <Button
              className="w-full"
              disabled={isSaving}
              icon={
                isSaving ? (
                  <Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" />
                ) : undefined
              }
              onClick={() => void handleSave()}
            >
              {isSaving ? "Saving…" : `Save ${items.length} medicine${items.length === 1 ? "" : "s"}`}
            </Button>
          )
        }
      >
        {saved ? (
          <div className="space-y-3 py-2 text-center">
            <CheckCircle2
              aria-hidden="true"
              className="mx-auto h-10 w-10 text-ok"
            />
            <p className="text-[17px] font-semibold text-label">
              {saved.count} medicine{saved.count === 1 ? "" : "s"} saved.
            </p>
            {saved.interactions ? (
              saved.interactions.interactions.length === 0 ? (
                <p className="text-[15px] text-label-2">
                  Checked for interactions — none found in the reviewed
                  sources.
                </p>
              ) : (
                <p className="text-[15px] text-label-2">
                  Checked for interactions —{" "}
                  {saved.interactions.interactions.length} found. Please review
                  them on the prescription page.
                </p>
              )
            ) : (
              <p className="text-[15px] text-label-2">
                The interaction check could not run right now. You can run it
                from the prescription page.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3 py-2">
            <p className="text-[17px] text-label-2">
              Save these {items.length} medicine
              {items.length === 1 ? "" : "s"} with the details you verified?
            </p>
            <ul className="max-h-56 space-y-1.5 overflow-y-auto">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="rounded-row bg-fill px-3 py-2 text-[15px] text-label"
                >
                  <span className="font-semibold">{item.medicine_name}</span>
                  {item.strength ? ` · ${item.strength}` : ""} ·{" "}
                  {item.frequency}
                </li>
              ))}
            </ul>
            <p className="text-[15px] text-label-3">
              We will also check these medicines for interactions with each
              other.
            </p>
          </div>
        )}
      </Sheet>

      <MedicalDisclaimerFooter />
    </div>
  );
}
