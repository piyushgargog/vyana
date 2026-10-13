"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  computeItemRefill,
  parseCarePlanJson,
  useActiveItems,
  useCarePlans,
  useDeleteAccount,
  useExportMyData,
  useLabReports,
  useMyAppointments,
  useMyProfile,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { AiSafetyBanner, SkeletonCard } from "@/components/ui-primitives";

export default function PatientDashboardPage() {
  const router = useRouter();
  const { supabase, showToast } = useVyanaWeb();
  const { data: profile, isLoading: profileLoading } = useMyProfile();

  // Active prescribed medications
  const { data: activeItems, isLoading: medsLoading } = useActiveItems();

  // Appointments (OPD Tokens)
  const { data: appointments, isLoading: apptsLoading } = useMyAppointments();

  // Approved Care Plans
  const { data: carePlans, isLoading: carePlansLoading } = useCarePlans();

  // Diagnostic Lab Reports
  const { data: labReports, isLoading: reportsLoading } = useLabReports();

  // Privacy: DPDP Data Export
  const exportMutation = useExportMyData();

  // Privacy: Account Deletion Modal & State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const deleteMutation = useDeleteAccount();

  const handleDownloadMyData = async () => {
    try {
      showToast("Preparing your clinical records export…", "info");
      const data = await exportMutation.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vyana-health-records-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Health data downloaded successfully.", "success");
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to export data",
        "error"
      );
    }
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deletePassword) {
      showToast("Password is required to confirm account deletion", "warning");
      return;
    }

    try {
      // 1. Re-authenticate password
      const { data: userData } = await supabase.auth.getUser();
      const userEmail = userData.user?.email;

      if (userEmail) {
        const { error: reauthError } = await supabase.auth.signInWithPassword({
          email: userEmail,
          password: deletePassword,
        });
        if (reauthError) {
          showToast(
            `Authentication failed: ${reauthError.message}`,
            "error"
          );
          return;
        }
      }

      // 2. Call server account deletion endpoint
      await deleteMutation.mutateAsync();
      await supabase.auth.signOut();
      setShowDeleteModal(false);
      setDeletePassword("");
      showToast("Your account & health records have been permanently deleted.", "warning");
      router.replace("/login");
    } catch (err: unknown) {
      const errorObj = err as { status?: number; code?: string; message?: string };
      if (errorObj?.status === 403 || errorObj?.code === "REAUTH_REQUIRED") {
        showToast(
          "Recent login required (403). Please re-enter your password to proceed.",
          "error"
        );
      } else {
        showToast(
          err instanceof Error ? err.message : "Could not delete account",
          "error"
        );
      }
    }
  };

  if (profileLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard lines={3} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  const upcomingAppointments = (appointments ?? []).filter(
    (a) => a.status === "requested" || a.status === "confirmed"
  );

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white font-bold text-base">
                व्य
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                  Welcome back, {profile?.full_name || "Patient"}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  Patient Health Dashboard · DPDP Act 2023 Compliant Health Summary
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2.5 text-xs">
              {profile?.blood_group && (
                <span className="rounded-md bg-red-50 border border-red-200 px-2 py-0.5 font-bold text-red-700">
                  Blood Group: {profile.blood_group}
                </span>
              )}
              {profile?.preferred_language && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 text-slate-600 capitalize">
                  Language: {profile.preferred_language}
                </span>
              )}
            </div>
          </div>

          {/* Critical Allergies Box */}
          <div className="w-full sm:w-72 shrink-0">
            {profile?.allergies && (Array.isArray(profile.allergies) ? profile.allergies.length > 0 : Boolean(profile.allergies)) ? (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-950">
                <span className="font-bold text-red-800 block">
                  Allergies on Record:
                </span>
                <span className="font-semibold text-red-900">
                  {Array.isArray(profile.allergies) ? profile.allergies.join(", ") : profile.allergies}
                </span>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                No known drug allergies reported.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Active Medicines & OPD Appointments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Card 1: Today's Active Prescribed Medicines */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Active Medications
              </h2>
              <p className="text-xs text-slate-500">
                Current prescribed daily dosages & refill tracking
              </p>
            </div>
            <span className="rounded-full bg-teal-50 border border-teal-200 px-2.5 py-0.5 text-xs font-bold text-teal-800">
              {activeItems?.length || 0} active
            </span>
          </div>

          {medsLoading ? (
            <SkeletonCard lines={2} />
          ) : !activeItems || activeItems.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No active medications on your record.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {activeItems.map((item) => {
                const refill = computeItemRefill(item);
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-100 bg-slate-50/60 p-3 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-sm">
                        {item.medicine_name} {item.strength || ""}
                      </span>
                      <span className="rounded bg-white border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700 uppercase">
                        {item.frequency}
                      </span>
                    </div>

                    <p className="text-slate-600">
                      {item.instructions || `${item.form || "Tablet"} ${item.times?.join(", ") || ""}`}
                    </p>

                    {refill.needsRefillSoon && (
                      <p className="font-bold text-amber-700 text-[11px] pt-0.5">
                        ⚠ Refill due soon ({refill.daysLeft} days remaining)
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Card 2: Upcoming OPD Tokens & Appointments */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Hospital OPD Appointments
              </h2>
              <p className="text-xs text-slate-500">
                Your booked government & verified OPD queue tokens
              </p>
            </div>
            <span className="rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-800">
              {upcomingAppointments.length} upcoming
            </span>
          </div>

          {apptsLoading ? (
            <SkeletonCard lines={2} />
          ) : upcomingAppointments.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center">
              No upcoming appointments. Book your next visit on mobile or ORS portal.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-80 overflow-y-auto">
              {upcomingAppointments.map((appt) => (
                <div
                  key={appt.id}
                  className="rounded-xl border border-blue-100 bg-blue-50/40 p-3 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-blue-900 text-sm">
                      <span className="rounded bg-blue-600 px-1.5 py-0.5 text-white text-[11px]">
                        #{appt.token_no.toString().padStart(2, "0")}
                      </span>
                      {appt.departments?.name || "OPD Department"}
                    </span>
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-800">
                      {appt.status}
                    </span>
                  </div>

                  <p className="text-slate-700 font-medium">
                    {appt.hospitals?.name || "Hospital"}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Date: <strong>{appt.appointment_date}</strong>
                    {appt.reason ? ` · Reason: ${appt.reason}` : ""}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Chronic Care Plans */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Approved Chronic Care Plans
            </h2>
            <p className="text-xs text-slate-500">
              Doctor-reviewed guidance, dietary protocols, and safety red flags
            </p>
          </div>
          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-800">
            {carePlans?.length || 0} plans
          </span>
        </div>

        {carePlansLoading ? (
          <SkeletonCard lines={2} />
        ) : !carePlans || carePlans.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No active care plans approved yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {carePlans.map((cp) => {
              const plan = parseCarePlanJson(cp.plan_json);
              if (!plan) return null;

              return (
                <div
                  key={cp.id}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 text-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-900">
                      {plan.condition}
                    </h3>
                    <span className="rounded-full bg-emerald-100 text-emerald-900 px-2 py-0.5 text-[10px] font-bold uppercase">
                      {cp.status}
                    </span>
                  </div>

                  <p className="text-slate-600">{plan.summary}</p>

                  {plan.do && plan.do.length > 0 && (
                    <div className="rounded-lg bg-teal-50 border border-teal-100 p-2.5 text-teal-950">
                      <strong className="block mb-1 text-teal-900 font-semibold">
                        Key Recommendations:
                      </strong>
                      <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                        {plan.do.slice(0, 2).map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Diagnostic Lab Reports Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Recent Lab Diagnostic Reports
            </h2>
            <p className="text-xs text-slate-500">
              Verified test readings and flagged abnormal values
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
            {labReports?.length || 0} reports
          </span>
        </div>

        {reportsLoading ? (
          <SkeletonCard lines={2} />
        ) : !labReports || labReports.length === 0 ? (
          <p className="text-xs text-slate-500 py-4 text-center">
            No lab reports uploaded yet.
          </p>
        ) : (
          <div className="space-y-3">
            {labReports.slice(0, 3).map((rep) => (
              <div
                key={rep.id}
                className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 text-xs space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900">
                    {rep.lab_name || "Diagnostic Laboratory"}
                  </span>
                  <span className="text-slate-500 text-[11px]">
                    {rep.report_date || rep.created_at.slice(0, 10)}
                  </span>
                </div>
                {rep.summary && (
                  <p className="text-slate-700">{rep.summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Privacy & DPDP Data Rights Section */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wider text-slate-800">
          DPDP Act 2023 · Privacy & Patient Rights
        </h2>
        <p className="text-xs text-slate-600">
          Under the Digital Personal Data Protection Act 2023, you have full ownership of your personal health data. You can download a complete portable copy of your records or permanently delete your account at any time.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            disabled={exportMutation.isPending}
            onClick={handleDownloadMyData}
            className="rounded-xl border border-teal-600 bg-teal-50 px-4 py-2 text-xs font-bold text-teal-800 hover:bg-teal-100 transition shadow-xs disabled:opacity-60"
          >
            {exportMutation.isPending ? "Generating Export…" : "Download Health Records (JSON)"}
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteModal(true)}
            className="rounded-xl border border-red-300 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition shadow-xs"
          >
            Delete My Account & Health Data
          </button>
        </div>
      </div>

      {/* Account Deletion Confirmation Modal with Password Re-auth */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-red-200">
            <h3 id="delete-dialog-title" className="text-base font-bold text-red-900">
              Permanently Delete Account & Health Data
            </h3>
            <p className="mt-2 text-xs text-slate-600">
              This action is permanent and cannot be undone. All personal profile records, prescriptions, lab values, and uploaded files will be erased.
            </p>

            <form onSubmit={handleConfirmDelete} className="mt-4 space-y-3">
              <div>
                <label
                  htmlFor="delete-pass-input"
                  className="block text-xs font-bold text-slate-800 mb-1"
                >
                  Enter Your Password to Confirm:
                </label>
                <input
                  id="delete-pass-input"
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter current password"
                  className="w-full rounded-xl border border-slate-300 p-2.5 text-xs text-slate-900 focus:border-red-600 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="rounded-xl border border-slate-300 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={deleteMutation.isPending}
                  className="rounded-xl bg-red-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-red-700 shadow-sm disabled:opacity-60"
                >
                  {deleteMutation.isPending ? "Deleting…" : "Confirm Permanent Deletion"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <AiSafetyBanner feature="patient-dashboard" />
    </div>
  );
}
