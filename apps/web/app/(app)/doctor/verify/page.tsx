"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  useMyDoctorProfile,
  useMyProfile,
  useVerifyDoctor,
  type DoctorVerifyRes,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { SkeletonCard } from "@/components/ui-primitives";

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
  const [userEditedYear, setUserEditedYear] = useState<number | null>(null);

  const regNo = userEditedRegNo ?? (doctorProfile?.reg_no || "");
  const stateCouncil = userEditedCouncil ?? (doctorProfile?.state_council || "Delhi Medical Council");
  const yearOfReg = userEditedYear ?? (doctorProfile?.year_of_registration || 2018);

  const [verifyResult, setVerifyResult] = useState<DoctorVerifyRes | null>(null);
  const [agentProgressStep, setAgentProgressStep] = useState<string>("");

  const verifyMutation = useVerifyDoctor();

  const handleStartVerification = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!regNo.trim()) {
      showToast("Medical registration number is required", "warning");
      return;
    }

    setVerifyResult(null);
    setAgentProgressStep("Connecting to National Medical Commission register…");

    // Simulated progress steps for TinyFish Agent showcase
    const timer1 = setTimeout(() => {
      setAgentProgressStep("Searching official council database records…");
    }, 1200);

    const timer2 = setTimeout(() => {
      setAgentProgressStep("Verifying practitioner credentials and qualification details…");
    }, 2800);

    try {
      const res = await verifyMutation.mutateAsync({
        reg_no: regNo.trim(),
        state_council: stateCouncil,
        year_of_registration: Number(yearOfReg),
      });

      clearTimeout(timer1);
      clearTimeout(timer2);
      setAgentProgressStep("");
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
      clearTimeout(timer1);
      clearTimeout(timer2);
      setAgentProgressStep("");
      showToast(
        err instanceof Error ? err.message : "Verification request failed",
        "error"
      );
    }
  };

  if (doctorLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={3} />
      </div>
    );
  }

  const isVerified = doctorProfile?.verification_status === "verified";
  const isFailed = doctorProfile?.verification_status === "failed";

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
            National Medical Commission (NMC) Verification
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-600">
            Official statutory verification of medical registration under the National Medical Commission Act.
          </p>
        </div>
        <Link
          href="/doctor"
          className="rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          ← Back to OPD Queue
        </Link>
      </div>

      {/* Current Status Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
          Current Verification Status
        </h2>

        {isVerified ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-emerald-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-lg">
                ✓
              </span>
              <div>
                <h3 className="text-base font-bold text-emerald-900">
                  Verified Registered Medical Practitioner
                </h3>
                <p className="text-xs text-emerald-800">
                  Reg No: <strong>{doctorProfile?.reg_no}</strong> ·{" "}
                  {doctorProfile?.state_council}
                  {doctorProfile?.verified_at &&
                    ` (Verified on ${doctorProfile.verified_at.slice(0, 10)})`}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-200 px-3 py-1 text-xs font-bold text-emerald-900 self-start sm:self-auto">
              VERIFIED
            </span>
          </div>
        ) : isFailed ? (
          <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-red-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-red-900">
                Verification Unsuccessful
              </h3>
              <p className="text-xs text-red-800 mt-0.5">
                The National Medical Commission registry did not confirm credentials matching this registration number.
              </p>
              {doctorProfile?.verification_json && (
                <pre className="mt-2 text-[11px] bg-white/70 p-2 rounded-lg border border-red-200 overflow-x-auto text-red-900">
                  {JSON.stringify(doctorProfile.verification_json, null, 2)}
                </pre>
              )}
            </div>
            <span className="rounded-full bg-red-200 px-3 py-1 text-xs font-bold text-red-900 self-start sm:self-auto">
              FAILED
            </span>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-amber-900">
                Verification Pending
              </h3>
              <p className="text-xs text-amber-800 mt-0.5">
                Your medical registration has not been verified yet. Run the automated check below to verify with the national register.
              </p>
            </div>
            <span className="rounded-full bg-amber-200 px-3 py-1 text-xs font-bold text-amber-900 self-start sm:self-auto">
              PENDING
            </span>
          </div>
        )}
      </div>

      {/* Verification Submission Form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-5">
        <div>
          <h2 className="text-base font-bold text-slate-900">
            Run Official Register Verification
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Our autonomous TinyFish verification agent navigates the National Medical Commission and State Medical Council registers to cross-reference your credentials.
          </p>
        </div>

        <form onSubmit={handleStartVerification} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="doctor-reg-no"
                className="block text-xs font-bold text-slate-800 mb-1"
              >
                Registration Number *
              </label>
              <input
                id="doctor-reg-no"
                type="text"
                required
                value={regNo}
                onChange={(e) => setUserEditedRegNo(e.target.value)}
                placeholder="e.g. 12345 or DMC/R/67890"
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm font-semibold text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="doctor-council"
                className="block text-xs font-bold text-slate-800 mb-1"
              >
                State Medical Council *
              </label>
              <select
                id="doctor-council"
                value={stateCouncil}
                onChange={(e) => setUserEditedCouncil(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white p-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              >
                {STATE_COUNCILS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="doctor-year"
                className="block text-xs font-bold text-slate-800 mb-1"
              >
                Year of Registration *
              </label>
              <input
                id="doctor-year"
                type="number"
                min="1950"
                max={new Date().getFullYear()}
                required
                value={yearOfReg}
                onChange={(e) => setUserEditedYear(parseInt(e.target.value) || 2018)}
                className="w-full rounded-xl border border-slate-300 p-2.5 text-xs sm:text-sm text-slate-900 focus:border-teal-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Agent Progress Showcase Banner */}
          {verifyMutation.isPending && (
            <div className="rounded-xl border border-teal-300 bg-teal-50 p-4 text-xs text-teal-950 flex items-center gap-3">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
              <div>
                <p className="font-bold text-teal-900">
                  Agent Autonomous Verification in Progress…
                </p>
                <p className="text-teal-800">{agentProgressStep}</p>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={verifyMutation.isPending}
              className="rounded-xl bg-teal-700 px-6 py-2.5 text-xs font-bold text-white hover:bg-teal-800 transition shadow-sm disabled:opacity-60"
            >
              {verifyMutation.isPending
                ? "Verifying with NMC…"
                : "Verify Credentials with NMC"}
            </button>
          </div>
        </form>
      </div>

      {/* Verification Result Showcase Card */}
      {verifyResult && (
        <div
          className={`rounded-2xl border p-5 sm:p-6 shadow-sm space-y-3 ${
            verifyResult.status === "verified"
              ? "border-emerald-300 bg-emerald-50/70"
              : "border-amber-300 bg-amber-50/70"
          }`}
        >
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              Verification Result from National Register
            </h3>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-bold uppercase ${
                verifyResult.status === "verified"
                  ? "bg-emerald-200 text-emerald-950"
                  : "bg-amber-200 text-amber-950"
              }`}
            >
              {verifyResult.status}
            </span>
          </div>

          {verifyResult.status === "verified" ? (
            <div className="space-y-2 text-xs text-emerald-950">
              <p className="text-sm font-bold text-emerald-900">
                Practitioner Match Confirmed:
              </p>
              <div className="rounded-xl bg-white p-3 border border-emerald-200 space-y-1">
                <p>
                  <strong>Registered Name:</strong>{" "}
                  {verifyResult.match?.name || profile?.full_name || "Doctor"}
                </p>
                <p>
                  <strong>Registration No:</strong>{" "}
                  {verifyResult.match?.reg_no || regNo}
                </p>
                <p>
                  <strong>Medical Council:</strong>{" "}
                  {verifyResult.match?.state_council || stateCouncil}
                </p>
                <p>
                  <strong>Registration Year:</strong>{" "}
                  {verifyResult.match?.year_of_registration || yearOfReg}
                </p>
                <p className="text-[11px] text-slate-500 pt-1">
                  Verified timestamp: {verifyResult.checked_at}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-xs text-amber-950">
              <p className="text-sm font-semibold">
                No automatic match found in public registry.
              </p>
              <p>
                Please verify that the registration number matches your state council certificate exactly. Hospital administrators can also manually review your registration in the Admin registry.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
