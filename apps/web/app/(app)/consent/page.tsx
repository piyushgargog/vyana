"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CONSENT_VERSION,
  useAcceptConsent,
  useConsent,
  useMyProfile,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { Button, Card, Pill } from "@/components/ui";

export default function ConsentPage() {
  const router = useRouter();
  const { showToast } = useVyanaWeb();
  const { data: consentRecord } = useConsent(CONSENT_VERSION);
  const { data: profile } = useMyProfile();
  const grantConsentMutation = useAcceptConsent();

  const [checkedPurpose, setCheckedPurpose] = useState(false);
  const [checkedAiNotice, setCheckedAiNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const alreadyConsented = Boolean(consentRecord);

  const handleAcceptConsent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await grantConsentMutation.mutateAsync(CONSENT_VERSION);
      showToast(`Consent recorded (${CONSENT_VERSION}) under DPDP Act 2023`, "success");
      if (!profile?.onboarded) {
        router.push("/onboarding");
      } else if (profile.role === "doctor") {
        router.push("/doctor");
      } else if (profile.role === "admin") {
        router.push("/admin/doctors");
      } else {
        router.push("/dashboard");
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Failed to record consent"
      );
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Card className="space-y-6 p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator pb-4">
          <div>
            <Pill tone="accent">DPDP Act 2023 · Data Fiduciary Notice</Pill>
            <h1 className="text-2xl font-bold text-label mt-2">
              Health Data & Privacy Consent
            </h1>
          </div>
          <span className="rounded-row border border-separator bg-fill px-3 py-1.5 text-xs font-mono font-semibold text-label-2">
            Version: {CONSENT_VERSION}
          </span>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-tile border border-danger/30 bg-danger-soft p-3 text-xs font-medium text-danger-text"
          >
            {errorMsg}
          </div>
        )}

        {alreadyConsented && (
          <div className="rounded-tile border border-ok/30 bg-ok-soft p-3.5 text-xs font-medium text-ok">
            Active consent recorded for policy version{" "}
            <strong>{CONSENT_VERSION}</strong>. You may review your rights below
            or export/delete your data at any time from your Profile.
          </div>
        )}

        <div className="space-y-4 text-sm text-label-2 leading-relaxed">
          <p>
            Before storing any personal health information in{" "}
            <strong>Vyana</strong>, please review in plain language what
            data we collect, why we process it, and how you stay in full control:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-tile border border-separator bg-fill p-4 space-y-1">
              <div className="font-bold text-label">
                1. What We Store & Why
              </div>
              <p className="text-label-2">
                Your profile, allergies, prescriptions, dose logs, lab reports,
                vitals, and OPD appointments are stored solely to power your
                personal health timeline, dose reminders, and doctor visits.
              </p>
            </div>

            <div className="rounded-tile border border-separator bg-fill p-4 space-y-1">
              <div className="font-bold text-label">
                2. Row-Level Security & Sharing
              </div>
              <p className="text-label-2">
                Your records are isolated by PostgreSQL Row-Level Security (RLS).
                Caregivers or doctors only see records you explicitly link or
                share via time-limited tokens.
              </p>
            </div>

            <div className="rounded-tile border border-separator bg-fill p-4 space-y-1">
              <div className="font-bold text-label">
                3. AI Redaction & Verification
              </div>
              <p className="text-label-2">
                Before text is sent to an AI model for extraction or
                plain-language explanation, phone numbers, emails, Aadhaar/PAN,
                and patient header blocks are removed from it. A photo is first
                read by a vision model that sees the whole image, so photograph
                only the document. You always review extracted values before
                saving.
              </p>
            </div>

            <div className="rounded-tile border border-separator bg-fill p-4 space-y-1">
              <div className="font-bold text-label">
                4. Right to Export & Erase
              </div>
              <p className="text-label-2">
                Under India&apos;s Digital Personal Data Protection (DPDP) Act
                2023, you can download all your health data as JSON or
                permanently delete your account and files in two taps.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleAcceptConsent} className="space-y-4 pt-2">
          <label className="flex items-start gap-3 text-xs sm:text-sm text-label cursor-pointer">
            <input
              type="checkbox"
              checked={checkedPurpose}
              onChange={(e) => setCheckedPurpose(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-separator accent-accent"
            />
            <span>
              I consent to Vyana storing and processing my health records for
              medication tracking, OPD bookings, lab trend analysis, and
              emergency Medical ID generation (Consent Version{" "}
              <code>{CONSENT_VERSION}</code>).
            </span>
          </label>

          <label className="flex items-start gap-3 text-xs sm:text-sm text-label cursor-pointer">
            <input
              type="checkbox"
              checked={checkedAiNotice}
              onChange={(e) => setCheckedAiNotice(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-separator accent-accent"
            />
            <span>
              I understand that Vyana is an informational health companion and
              not a substitute for professional medical diagnosis or emergency
              care.
            </span>
          </label>

          <p className="text-xs text-label-3 pt-1">
            Please read our full{" "}
            <Link
              href="/privacy"
              target="_blank"
              className="font-medium text-accent-strong underline"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/terms"
              target="_blank"
              className="font-medium text-accent-strong underline"
            >
              Terms of Service
            </Link>
            .
          </p>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <Button
              type="submit"
              disabled={
                !checkedPurpose ||
                !checkedAiNotice ||
                grantConsentMutation.isPending
              }
            >
              {grantConsentMutation.isPending
                ? "Recording Consent…"
                : "I Consent & Continue →"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
