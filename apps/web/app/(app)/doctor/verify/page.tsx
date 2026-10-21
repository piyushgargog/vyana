"use client";

import React, { useState } from "react";
import {
  useMyDoctorProfile,
  useMyProfile,
  useVerifyDoctor,
  type DoctorVerifyRes,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import {
  Button,
  ButtonLink,
  Card,
  CardHeader,
  Field,
  LargeTitle,
  Pill,
  SelectField,
  SkeletonLine,
  cn,
} from "@/components/ui";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Loader2,
} from "lucide-react";

const STATE_COUNCILS = [
  "Delhi Medical Council",
  "Maharashtra Medical Council",
  "Karnataka Medical Council",
  "Tamil Nadu Medical Council",
  "Uttar Pradesh Medical Council",
  "West Bengal Medical Council",
  "Andhra Pradesh Medical Council",
  "Gujarat Medical Council",
  "Kerala Medical Council",
  "Punjab Medical Council",
  "Rajasthan Medical Council",
  "National Medical Commission",
  "Medical Council of India",
];

export default function DoctorVerifyPage() {
  const { showToast } = useVyanaWeb();
  const { data: profile } = useMyProfile();
  const {
    data: doctorProfile,
    isLoading: doctorLoading,
    refetch,
  } = useMyDoctorProfile();

  const [userEditedRegNo, setUserEditedRegNo] = useState<string | null>(null);
  const [userEditedCouncil, setUserEditedCouncil] = useState<string | null>(null);
  const [userEditedYear, setUserEditedYear] = useState<string | null>(null);

  const regNo = userEditedRegNo ?? (doctorProfile?.reg_no || "");
  // Issue #131: State Council picker starts empty
  const stateCouncil = userEditedCouncil ?? (doctorProfile?.state_council || "");
  const yearOfReg =
    userEditedYear !== null
      ? userEditedYear
      : doctorProfile?.year_of_registration
        ? String(doctorProfile.year_of_registration)
        : "";

  const [verifyResult, setVerifyResult] = useState<DoctorVerifyRes | null>(null);

  const verifyMutation = useVerifyDoctor();

  const handleStartVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regNo.trim()) {
      showToast("Medical registration number is required", "warning");
      return;
    }

    if (!stateCouncil.trim()) {
      showToast("State Medical Council is required", "warning");
      return;
    }

    setVerifyResult(null);

    try {
      const parsedYear = yearOfReg.trim() ? parseInt(yearOfReg.trim(), 10) : NaN;
      const hasValidYear =
        Number.isInteger(parsedYear) &&
        parsedYear >= 1950 &&
        parsedYear <= new Date().getFullYear();

      const res = await verifyMutation.mutateAsync({
        reg_no: regNo.trim(),
        state_council: stateCouncil.trim(),
        ...(hasValidYear ? { year_of_registration: parsedYear } : {}),
      });

      setVerifyResult(res);

      if (res.status === "verified") {
        showToast("NMC Verification Successful! Doctor credentials confirmed.", "success");
      } else {
        showToast(
          `Verification status: ${res.status}. See details below.`,
          "warning"
        );
      }
      await refetch();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Verification request failed",
        "error"
      );
    }
  };

  if (doctorLoading) {
    return (
      <div className="space-y-6">
        <Card className="space-y-3">
          <SkeletonLine className="h-7 w-1/3" />
          <SkeletonLine className="h-5 w-2/3" />
        </Card>
        <Card className="space-y-4">
          <SkeletonLine className="h-6 w-1/4" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SkeletonLine className="h-12 w-full" />
            <SkeletonLine className="h-12 w-full" />
            <SkeletonLine className="h-12 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  const isVerified = doctorProfile?.verification_status === "verified";
  const isFailed = doctorProfile?.verification_status === "failed";

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <LargeTitle
        eyebrow="Statutory Verification"
        title="National Medical Commission (NMC)"
        subtitle="Official statutory verification of medical registration under the National Medical Commission Act."
        actions={
          <ButtonLink
            href="/doctor"
            variant="secondary"
            size="sm"
            icon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
          >
            OPD Queue
          </ButtonLink>
        }
      />

      {/* Current Status Card */}
      <Card>
        <CardHeader title="Current Verification Status" />

        {isVerified ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-tile bg-ok-soft p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ok text-white font-bold text-lg">
                <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <h3 className="text-[17px] font-semibold text-label">
                  Checked by Vyana admin
                </h3>
                <p className="text-[13px] text-label-2">
                  Reg No: <strong className="text-label">{doctorProfile?.reg_no}</strong> ·{" "}
                  {doctorProfile?.state_council}
                  {doctorProfile?.verified_at &&
                    ` (Checked by Vyana admin on ${doctorProfile.verified_at.slice(0, 10)})`}
                </p>
              </div>
            </div>
            <Pill tone="ok" className="self-start sm:self-auto">
              Checked
            </Pill>
          </div>
        ) : isFailed ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-tile bg-danger-soft p-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-danger-text shrink-0" aria-hidden="true" />
                <h3 className="text-[17px] font-semibold text-danger-text">
                  Registration not confirmed
                </h3>
              </div>
              <p className="text-[13px] text-label-2">
                The admin check against the register did not confirm credentials matching this registration number.
              </p>
              {doctorProfile?.verification_json && (
                <pre className="mt-3 max-h-48 overflow-x-auto rounded-row bg-fill p-3 text-[11px] font-mono text-label">
                  {JSON.stringify(doctorProfile.verification_json, null, 2)}
                </pre>
              )}
            </div>
            <Pill tone="danger" className="self-start sm:self-auto">
              Not approved
            </Pill>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-tile bg-warn-soft p-4">
            <div>
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-warn shrink-0" aria-hidden="true" />
                <h3 className="text-[17px] font-semibold text-warn">
                  Not checked yet
                </h3>
              </div>
              <p className="mt-1 text-[13px] text-label-2">
                Your medical registration has not been checked yet. An admin checks it by hand against the register — the details you submit below are what they compare.
              </p>
            </div>
            <Pill tone="warn" className="self-start sm:self-auto">
              Not checked yet
            </Pill>
          </div>
        )}
      </Card>

      {/* Verification Submission Form */}
      <Card>
        <CardHeader
          title="Run Official Register Verification"
          trailing={
            <span className="text-[13px] text-label-3">
              National & State Registers
            </span>
          }
        />
        <p className="mb-4 text-[15px] text-label-2">
          Checks the National Medical Commission and State Medical Council registers to cross-reference your credentials.
        </p>

        <form onSubmit={handleStartVerification} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Field
              id="doctor-reg-no"
              label="Registration Number *"
              required
              value={regNo}
              onChange={(e) => setUserEditedRegNo(e.target.value)}
              placeholder="e.g. 12345 or DMC/R/67890"
            />

            <SelectField
              id="doctor-council"
              label="State Medical Council *"
              required
              value={stateCouncil}
              onChange={(e) => setUserEditedCouncil(e.target.value)}
            >
              <option value="">Select Council…</option>
              {STATE_COUNCILS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </SelectField>

            <Field
              id="doctor-year"
              label="Year of Registration (Optional)"
              type="number"
              min="1950"
              max={new Date().getFullYear()}
              placeholder="e.g. 2018 (optional)"
              value={yearOfReg}
              onChange={(e) => setUserEditedYear(e.target.value)}
            />
          </div>

          {/* Status Line Banner */}
          {verifyMutation.isPending && (
            <div className="flex items-center gap-3 rounded-tile bg-accent-soft p-4 text-[15px] text-accent-strong">
              <Loader2 className="h-5 w-5 animate-spin shrink-0" aria-hidden="true" />
              <p className="font-semibold">
                Checking the NMC register. This can take up to a minute.
              </p>
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-2">
            {process.env.NODE_ENV !== "production" ? (
              <p className="text-[13px] text-label-3">
                Mock mode: Delhi Medical Council / 12345 with the name Sneha Gupta verifies (seeded doctor2).
              </p>
            ) : (
              <span />
            )}
            <Button
              type="submit"
              variant="primary"
              disabled={verifyMutation.isPending}
              icon={
                verifyMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : undefined
              }
            >
              {verifyMutation.isPending
                ? "Verifying with NMC…"
                : "Verify Credentials with NMC"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Verification Result Showcase Card */}
      {verifyResult && (
        <Card
          className={cn(
            "border",
            verifyResult.status === "verified"
              ? "border-ok/30 bg-ok-soft/30"
              : verifyResult.status === "failed"
                ? "border-danger/30 bg-danger-soft/30"
                : "border-warn/30 bg-warn-soft/30"
          )}
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-[17px] font-semibold text-label">
              Verification Result from National Register
            </h3>
            <Pill
              tone={
                verifyResult.status === "verified"
                  ? "ok"
                  : verifyResult.status === "failed"
                    ? "danger"
                    : "warn"
              }
            >
              {verifyResult.status}
            </Pill>
          </div>

          {verifyResult.status === "verified" ? (
            <div className="space-y-3">
              <p className="text-[15px] font-semibold text-ok">
                Register Record Match Confirmed:
              </p>
              <div className="rounded-tile bg-surface p-4 border border-separator space-y-1.5 text-[15px]">
                <p className="text-label-2">
                  <strong className="text-label">Registered Name:</strong>{" "}
                  {verifyResult.match?.name || profile?.full_name || "Doctor"}
                </p>
                <p className="text-label-2">
                  <strong className="text-label">Registration No:</strong>{" "}
                  {verifyResult.match?.reg_no || regNo}
                </p>
                <p className="text-label-2">
                  <strong className="text-label">Medical Council:</strong>{" "}
                  {verifyResult.match?.state_council || stateCouncil}
                </p>
                <p className="text-label-2">
                  <strong className="text-label">Registration Year:</strong>{" "}
                  {verifyResult.match?.year_of_registration || yearOfReg || "Not specified"}
                </p>
                <p className="pt-1 text-[13px] text-label-3">
                  Verified timestamp: {verifyResult.checked_at}
                </p>
              </div>
            </div>
          ) : verifyResult.status === "failed" ? (
            <div className="space-y-1 text-[15px]">
              <p className="font-semibold text-danger-text">
                {verifyResult.match?.name
                  ? `The register shows: ${verifyResult.match.name}`
                  : "Not found on the register"}
              </p>
              <p className="text-label-2">
                {verifyResult.match?.name
                  ? "The practitioner name on your account does not match the name recorded in the state medical council register for this number."
                  : "Please verify that the registration number matches your state council certificate exactly."}
              </p>
            </div>
          ) : (
            <div className="space-y-1 text-[15px]">
              <p className="font-semibold text-warn">
                The register couldn&apos;t be checked right now. Try again later.
              </p>
              <p className="text-label-2">
                The national register did not respond within the timeout window. Your status remains pending.
              </p>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
