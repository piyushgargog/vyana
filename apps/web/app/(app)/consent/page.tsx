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

export default function ConsentPage() {
  const router = useRouter();
  const { showToast } = useVyanaWeb();
  const { data: consentRecord } = useConsent(CONSENT_VERSION);
  const { data: profile } = useMyProfile();
  const grantConsentMutation = useAcceptConsent();

  const [checkedPurpose, setCheckedPurpose] = useState(true);
  const [checkedAiNotice, setCheckedAiNotice] = useState(true);
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
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-sm space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div>
            <span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-900">
              DPDP Act 2023 · Data Fiduciary Notice
            </span>
            <h1 className="text-2xl font-bold text-slate-900 mt-2">
              Health Data & Privacy Consent
            </h1>
          </div>
          <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-mono font-semibold text-slate-700">
            Version: {CONSENT_VERSION}
          </span>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-800"
          >
            {errorMsg}
          </div>
        )}

        {alreadyConsented && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs font-medium text-emerald-900">
            Active consent recorded for policy version{" "}
            <strong>{CONSENT_VERSION}</strong>. You may review your rights below
            or export/delete your data at any time from your Profile.
          </div>
        )}

        <div className="space-y-4 text-sm text-slate-700 leading-relaxed">
          <p>
            Before storing any personal health information in{" "}
            <strong>Vyana</strong>, please review in plain language what
            data we collect, why we process it, and how you stay in full control:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <div className="font-bold text-slate-900">
                1. What We Store & Why
              </div>
              <p className="text-slate-600">
                Your profile, allergies, prescriptions, dose logs, lab reports,
                vitals, and OPD appointments are stored solely to power your
                personal health timeline, dose reminders, and doctor visits.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <div className="font-bold text-slate-900">
                2. Row-Level Security & Sharing
              </div>
              <p className="text-slate-600">
                Your records are isolated by PostgreSQL Row-Level Security (RLS).
                Caregivers or doctors only see records you explicitly link or
                share via time-limited tokens.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <div className="font-bold text-slate-900">
                3. AI Redaction & Verification
              </div>
              <p className="text-slate-600">
                Before text is sent to an AI model for OCR or plain-language
                explanation, phone numbers, emails, Aadhaar/PAN, and patient
                header blocks are stripped. You always review extracted values
                before saving.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-1">
              <div className="font-bold text-slate-900">
                4. Right to Export & Erase
              </div>
              <p className="text-slate-600">
                Under India&apos;s Digital Personal Data Protection (DPDP) Act
                2023, you can download all your health data as JSON or
                permanently delete your account and files in two taps.
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleAcceptConsent} className="space-y-4 pt-2">
          <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={checkedPurpose}
              onChange={(e) => setCheckedPurpose(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            />
            <span>
              I consent to Vyana storing and processing my health records for
              medication tracking, OPD bookings, lab trend analysis, and
              emergency Medical ID generation (Consent Version{" "}
              <code>{CONSENT_VERSION}</code>).
            </span>
          </label>

          <label className="flex items-start gap-3 text-xs sm:text-sm text-slate-800 cursor-pointer">
            <input
              type="checkbox"
              checked={checkedAiNotice}
              onChange={(e) => setCheckedAiNotice(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            />
            <span>
              I understand that Vyana is an informational health companion and
              not a substitute for professional medical diagnosis or emergency
              care.
            </span>
          </label>

          <p className="text-xs text-slate-500 pt-1">
            Please read our full{" "}
            <Link
              href="/privacy"
              target="_blank"
              className="font-medium text-teal-700 underline"
            >
              Privacy Policy
            </Link>{" "}
            and{" "}
            <Link
              href="/terms"
              target="_blank"
              className="font-medium text-teal-700 underline"
            >
              Terms of Service
            </Link>
            .
          </p>

          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={
                !checkedPurpose ||
                !checkedAiNotice ||
                grantConsentMutation.isPending
              }
              className="rounded-xl bg-teal-700 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
            >
              {grantConsentMutation.isPending
                ? "Recording Consent…"
                : "I Consent & Continue →"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
