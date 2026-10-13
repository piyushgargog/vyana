"use client";

import React, { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import {
  useCarePlans,
  useCheckInteractions,
  useLabReports,
  usePrescriptions,
  useTimeline,
  type CarePlan,
  type DbEmergencyContact,
  type DbProfile,
  type DbVital,
  type InteractionsRes,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import {
  AiSafetyBanner,
  SkeletonCard,
  TrendChartSvg,
  type TrendPoint,
} from "@/components/ui-primitives";

interface LabReportVal {
  test_name: string;
  value?: string | number;
  value_text?: string;
  unit?: string;
  reference_range?: string;
  ref_low?: number | string | null;
  ref_high?: number | string | null;
  flag?: string;
}

function DoctorPatientSummaryContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = use(params);
  const { supabase, showToast } = useVyanaWeb();

  const [activeTab, setActiveTab] = useState<
    "meds" | "conditions" | "labs" | "vitals" | "timeline"
  >("meds");

  // Patient Profile state
  const [patientProfile, setPatientProfile] = useState<DbProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Emergency contacts state
  const [contacts, setContacts] = useState<DbEmergencyContact[]>([]);

  // Vitals state
  const [vitals, setVitals] = useState<DbVital[]>([]);
  const [vitalsLoading, setVitalsLoading] = useState(true);

  useEffect(() => {
    if (!patientId) return;
    let ignore = false;
    async function loadPatientDetails() {
      try {
        const [profRes, contactsRes, vitalsRes] = await Promise.all([
          supabase.from("profiles").select("*").eq("id", patientId).maybeSingle(),
          supabase.from("emergency_contacts").select("*").eq("patient_id", patientId).order("created_at"),
          supabase.from("vitals").select("*").eq("patient_id", patientId).order("measured_at", { ascending: false }),
        ]);

        if (ignore) return;
        if (profRes.error) throw profRes.error;
        setPatientProfile(profRes.data as DbProfile | null);
        setContacts((contactsRes.data ?? []) as DbEmergencyContact[]);
        setVitals((vitalsRes.data ?? []) as DbVital[]);
      } catch (err) {
        if (!ignore) {
          setProfileError(
            err instanceof Error ? err.message : "Failed to load patient profile"
          );
        }
      } finally {
        if (!ignore) {
          setProfileLoading(false);
          setVitalsLoading(false);
        }
      }
    }
    loadPatientDetails();
    return () => {
      ignore = true;
    };
  }, [patientId, supabase]);

  // Prescriptions & Active Medicines from shared hooks
  const { data: prescriptions, isLoading: rxLoading } =
    usePrescriptions(patientId);

  // Care plans
  const { data: carePlans, isLoading: carePlansLoading } =
    useCarePlans(patientId);

  // Lab reports
  const { data: labReports, isLoading: labsLoading } =
    useLabReports(patientId);

  // Chronological Timeline
  const { data: timeline, isLoading: timelineLoading } =
    useTimeline(patientId);

  // Active medicines list across prescriptions
  const allActiveItems = (prescriptions ?? [])
    .flatMap((p) => p.prescription_items ?? [])
    .filter((item) => item.active);

  // Drug Interaction Checking
  const checkInteractionsMutation = useCheckInteractions();
  const [interactionResult, setInteractionResult] = useState<InteractionsRes | null>(
    null
  );
  const [interactionNotice, setInteractionNotice] = useState<string | null>(null);

  const handleCheckInteractions = async () => {
    try {
      setInteractionNotice(null);
      const res = await checkInteractionsMutation.mutateAsync({});
      setInteractionResult(res);
      showToast("Drug-drug interaction analysis completed.", "info");
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      if (errorObj?.status === 403) {
        setInteractionNotice(
          "Automated cross-check server service is restricted to patient sessions. Manual verification required: verify active medications against BNF / National Formulary of India guidelines."
        );
      } else {
        setInteractionNotice(
          err instanceof Error
            ? `Interactions check error: ${err.message}`
            : "Could not connect to drug interactions safety service."
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

  if (profileError || !patientProfile) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        <h2 className="text-base font-bold">Patient record not accessible</h2>
        <p className="mt-1 text-xs">
          {profileError ||
            "Unable to access patient summary under clinical authorization rules."}
        </p>
        <Link
          href="/doctor"
          className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-800"
        >
          Return to Queue
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/doctor"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-900"
        >
          ← Back to OPD Queue
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href={`/doctor/appointments/new/prescribe?patientId=${patientId}`}
            className="rounded-xl bg-teal-700 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-teal-800 transition shadow-sm"
          >
            + Write e-Prescription
          </Link>
        </div>
      </div>

      {/* Patient Clinical Demographics Banner */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                {patientProfile.full_name || "Patient Record"}
              </h1>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                Patient ID: {patientId.slice(0, 8)}…
              </span>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-600">
              {patientProfile.blood_group && (
                <span className="inline-flex items-center gap-1 font-bold text-red-700 bg-red-50 border border-red-200 rounded-md px-2 py-0.5">
                  Blood Group: {patientProfile.blood_group}
                </span>
              )}
              {patientProfile.preferred_language && (
                <span>
                  Language:{" "}
                  <strong className="capitalize text-slate-800">
                    {patientProfile.preferred_language}
                  </strong>
                </span>
              )}
              {patientProfile.phone && (
                <span>
                  Phone:{" "}
                  <strong className="text-slate-800">{patientProfile.phone}</strong>
                </span>
              )}
            </div>

            {/* Emergency Contacts */}
            {contacts && contacts.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">
                  Emergency Contacts:
                </span>
                {contacts.map((c: DbEmergencyContact) => (
                  <span
                    key={c.id}
                    className="rounded-lg bg-slate-50 border border-slate-200 px-2 py-0.5"
                  >
                    {c.name} ({c.relation || "contact"}): {c.phone}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Critical Safety: Known Allergies Warning */}
          <div className="w-full sm:w-80 shrink-0">
            {patientProfile.allergies && patientProfile.allergies.length > 0 ? (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3.5 text-xs text-red-950 shadow-xs">
                <div className="flex items-center gap-2 font-bold text-red-800">
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white text-[11px]"
                  >
                    !
                  </span>
                  <span>KNOWN PATIENT ALLERGIES</span>
                </div>
                <p className="mt-1 font-semibold text-red-900 text-sm">
                  {patientProfile.allergies.join(", ")}
                </p>
                <p className="mt-1 text-[11px] text-red-700">
                  Verify contraindicated compounds before prescribing antibiotics or analgesics.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <span className="font-semibold text-slate-700">Allergies:</span>{" "}
                No known drug allergies reported by patient.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Clinical Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pb-0.5">
        {(
          [
            { id: "meds", label: `Active Medications (${allActiveItems.length})` },
            { id: "conditions", label: `Care Plans & Conditions (${carePlans?.length ?? 0})` },
            { id: "labs", label: `Lab Reports (${labReports?.length ?? 0})` },
            { id: "vitals", label: `Vitals & Trends (${vitals.length})` },
            { id: "timeline", label: "Health Timeline" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`shrink-0 rounded-t-xl px-4 py-2 text-xs font-bold transition border-b-2 ${
              activeTab === tab.id
                ? "border-teal-700 bg-white text-teal-800 shadow-xs"
                : "border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 1: Active Medications & Drug Interactions */}
      {activeTab === "meds" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Active Prescribed Medicines
              </h2>
              <p className="text-xs text-slate-500">
                Current active regimens from digital prescriptions and verified records.
              </p>
            </div>
            <button
              type="button"
              disabled={checkInteractionsMutation.isPending}
              onClick={handleCheckInteractions}
              className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition shadow-xs"
            >
              {checkInteractionsMutation.isPending
                ? "Checking Safety…"
                : "Check Drug Interactions"}
            </button>
          </div>

          {/* Interaction Notice / Results */}
          {interactionNotice && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
              <p className="font-semibold">{interactionNotice}</p>
            </div>
          )}

          {interactionResult && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900">
                  Drug Interaction Safety Analysis
                </h3>
                <span className="text-xs text-slate-500">
                  Checked {interactionResult.checked_medicines?.length || 0} drugs
                </span>
              </div>

              {interactionResult.interactions?.length === 0 ? (
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-900">
                  ✓ No severe drug-drug interactions detected between the analyzed medicines.
                </div>
              ) : (
                <div className="space-y-2">
                  {interactionResult.interactions?.map((it, idx: number) => (
                    <div
                      key={idx}
                      className={`rounded-xl border p-3 text-xs ${
                        it.severity === "major"
                          ? "border-red-300 bg-red-50 text-red-950"
                          : "border-amber-300 bg-amber-50 text-amber-950"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>
                          {it.medicine_a} ↔ {it.medicine_b}
                        </span>
                        <span
                          className={`rounded px-1.5 py-0.5 text-[10px] uppercase ${
                            it.severity === "major"
                              ? "bg-red-200 text-red-900"
                              : "bg-amber-200 text-amber-900"
                          }`}
                        >
                          {it.severity} risk
                        </span>
                      </div>
                      <p className="mt-1">{it.effect}</p>
                      {it.advice && (
                        <p className="mt-1 font-semibold text-slate-800">
                          Advice: {it.advice}
                        </p>
                      )}
                      {it.quote && (
                        <p className="mt-1.5 italic text-slate-600 bg-white/70 p-1.5 rounded">
                          &ldquo;{it.quote}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Medication Cards */}
          {rxLoading ? (
            <SkeletonCard lines={3} />
          ) : allActiveItems.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm">
              No active medications currently registered for this patient.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allActiveItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        {item.medicine_name} {item.strength || ""}
                      </h3>
                      <p className="text-xs text-slate-600">
                        {item.form || "Tablet"} · {item.frequency}
                        {item.times && item.times.length > 0
                          ? ` (${item.times.join(", ")})`
                          : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Active
                    </span>
                  </div>

                  {item.instructions && (
                    <p className="mt-2 text-xs text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100">
                      <strong>Instructions:</strong> {item.instructions}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
                    <span>Quantity: {item.quantity_total || "—"}</span>
                    <span>Started: {item.start_date || "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Care Plans & Chronic Conditions */}
      {activeTab === "conditions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">
              Chronic Care Plans & Disease Management
            </h2>
          </div>

          {carePlansLoading ? (
            <SkeletonCard lines={3} />
          ) : !carePlans || carePlans.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm">
              No chronic care plans authored or linked for this patient yet.
            </div>
          ) : (
            <div className="space-y-3">
              {carePlans.map((cp) => {
                const planDoc = cp.plan_json as unknown as CarePlan | null;
                const isApproved = cp.status === "approved";
                const isDraft = cp.status === "draft";

                return (
                  <div
                    key={cp.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">
                            {planDoc?.condition || "Care Plan"}
                          </h3>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-bold uppercase ${
                              isApproved
                                ? "bg-emerald-100 text-emerald-800"
                                : isDraft
                                  ? "bg-amber-100 text-amber-800"
                                  : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {cp.status}
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {isApproved
                            ? `Approved on ${cp.reviewed_at?.slice(0, 10)}`
                            : "Draft plan pending doctor review"}
                        </p>
                      </div>

                      <Link
                        href={`/doctor/care-plans/${cp.id}`}
                        className="rounded-xl border border-teal-600 bg-teal-50 px-3.5 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-100 self-start sm:self-auto"
                      >
                        {isApproved ? "View Plan" : "Review & Approve"}
                      </Link>
                    </div>

                    {/* Summary & Key Do's */}
                    {planDoc?.summary && (
                      <p className="mt-3 text-xs sm:text-sm text-slate-700">
                        {planDoc.summary}
                      </p>
                    )}

                    {planDoc?.do && planDoc.do.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="rounded-xl bg-teal-50/60 p-3 border border-teal-100">
                          <span className="font-bold text-teal-900 block mb-1">
                            Recommended Actions (Do):
                          </span>
                          <ul className="list-disc pl-4 space-y-0.5 text-teal-950">
                            {planDoc.do.slice(0, 3).map((item: string, i: number) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>

                        {planDoc.red_flags && planDoc.red_flags.length > 0 && (
                          <div className="rounded-xl bg-red-50/60 p-3 border border-red-100">
                            <span className="font-bold text-red-900 block mb-1">
                              Emergency Red Flags:
                            </span>
                            <ul className="list-disc pl-4 space-y-0.5 text-red-950">
                              {planDoc.red_flags.slice(0, 3).map((rf: string, i: number) => (
                                <li key={i}>{rf}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Lab Reports */}
      {activeTab === "labs" && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Diagnostic Laboratory Reports
          </h2>

          {labsLoading ? (
            <SkeletonCard lines={3} />
          ) : !labReports || labReports.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm">
              No laboratory reports uploaded for this patient.
            </div>
          ) : (
            <div className="space-y-3">
              {labReports.map((report) => {
                const ext = report.extracted_json as {
                  values?: LabReportVal[];
                } | null;
                const values = ext?.values ?? [];

                return (
                  <div
                    key={report.id}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">
                          {report.lab_name || "Diagnostic Report"}
                        </h3>
                        <p className="text-xs text-slate-500">
                          Report Date: {report.report_date || report.created_at.slice(0, 10)}
                        </p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                        {values.length} tests recorded
                      </span>
                    </div>

                    {report.summary && (
                      <p className="mt-2.5 text-xs text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                        <strong>Clinical Summary:</strong> {report.summary}
                      </p>
                    )}

                    {/* Table of test values */}
                    {values.length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-700 border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                              <th className="py-1.5 pr-3">Test</th>
                              <th className="py-1.5 pr-3">Value</th>
                              <th className="py-1.5 pr-3">Ref Range</th>
                              <th className="py-1.5">Flag</th>
                            </tr>
                          </thead>
                          <tbody>
                            {values.map((val: LabReportVal, idx: number) => {
                              const isAbnormal = val.flag === "high" || val.flag === "low";
                              return (
                                <tr
                                  key={idx}
                                  className={`border-b border-slate-100 ${
                                    isAbnormal ? "bg-red-50/40" : ""
                                  }`}
                                >
                                  <td className="py-1.5 pr-3 font-semibold text-slate-900">
                                    {val.test_name}
                                  </td>
                                  <td className="py-1.5 pr-3 font-bold">
                                    {val.value ?? val.value_text} {val.unit || ""}
                                  </td>
                                  <td className="py-1.5 pr-3 text-slate-500">
                                    {val.ref_low != null && val.ref_high != null
                                      ? `${val.ref_low} – ${val.ref_high} ${val.unit || ""}`
                                      : "—"}
                                  </td>
                                  <td className="py-1.5">
                                    {val.flag ? (
                                      <span
                                        className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase ${
                                          val.flag === "high"
                                            ? "bg-red-100 text-red-800"
                                            : val.flag === "low"
                                              ? "bg-blue-100 text-blue-800"
                                              : "bg-teal-100 text-teal-800"
                                        }`}
                                      >
                                        {val.flag}
                                      </span>
                                    ) : (
                                      <span className="text-slate-400">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Vitals & Trends */}
      {activeTab === "vitals" && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Vital Signs & Trend Visualizations
          </h2>

          {vitalsLoading ? (
            <SkeletonCard lines={3} />
          ) : vitals.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm">
              No vitals logged for this patient yet.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Trend Chart for Sugar Fasting / BP if points exist */}
              {(() => {
                const sugarPoints: TrendPoint[] = vitals
                  .filter((v: DbVital) => v.type === "sugar_fasting" && v.value != null)
                  .map((v: DbVital) => ({
                    date: v.measured_at.slice(5, 10),
                    value: v.value,
                    flag: v.value > 126 ? "high" : v.value < 70 ? "low" : "normal",
                  }));

                if (sugarPoints.length > 0) {
                  return (
                    <TrendChartSvg
                      title="Fasting Blood Glucose"
                      unit="mg/dL"
                      points={sugarPoints.reverse()}
                      refLow={70}
                      refHigh={100}
                    />
                  );
                }
                return null;
              })()}

              {/* Vitals Table */}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-700 border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500 font-semibold">
                      <th className="py-2 pr-3">Measured On</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Reading</th>
                      <th className="py-2">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vitals.map((v: DbVital) => (
                      <tr key={v.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-500">
                          {v.measured_at.slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="py-2 pr-3 font-semibold capitalize text-slate-900">
                          {v.type.replace("_", " ")}
                        </td>
                        <td className="py-2 pr-3 font-bold text-slate-800">
                          {v.value}
                          {v.value2 != null ? ` / ${v.value2}` : ""}
                        </td>
                        <td className="py-2 text-slate-500">{v.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Clinical Timeline */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Chronological Care History
          </h2>

          {timelineLoading ? (
            <SkeletonCard lines={3} />
          ) : !timeline || timeline.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500 shadow-sm">
              No historical health events recorded.
            </div>
          ) : (
            <div className="space-y-2 border-l-2 border-teal-600/30 pl-4 ml-2">
              {timeline.map((entry) => (
                <div
                  key={`${entry.kind}-${entry.id}`}
                  className="relative rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs"
                >
                  <span className="absolute -left-[23px] top-4 h-3 w-3 rounded-full bg-teal-700 ring-4 ring-white" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-400">
                      {entry.date}
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                      {entry.kind}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-bold text-slate-900">
                    {entry.title}
                  </h3>
                  {entry.subtitle && (
                    <p className="mt-0.5 text-xs text-slate-600">
                      {entry.subtitle}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AiSafetyBanner feature="doctor-patient-summary" contextId={patientId} />
    </div>
  );
}

export default function DoctorPatientSummaryPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={5} />
        </div>
      }
    >
      <DoctorPatientSummaryContent {...props} />
    </Suspense>
  );
}
