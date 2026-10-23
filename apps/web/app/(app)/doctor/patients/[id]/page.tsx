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
import { Button, ButtonLink, Card, Pill } from "@/components/ui";

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
            err instanceof Error ? err.message : "Please try again in a moment."
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
      const res = await checkInteractionsMutation.mutateAsync({ patient_id: patientId });
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
      <div className="rounded-card border border-danger/30 bg-danger-soft p-6 text-sm text-danger-text">
        <h2 className="text-base font-bold">Patient record not accessible</h2>
        <p className="mt-1 text-xs">
          {profileError ||
            "Unable to access patient summary under clinical authorization rules."}
        </p>
        <ButtonLink href="/doctor" size="sm" className="mt-4">
          Return to Queue
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Navigation & Breadcrumbs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/doctor"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-strong hover:text-accent"
        >
          ← Back to OPD Queue
        </Link>
        <div className="flex items-center gap-2">
          <ButtonLink
            href={`/doctor/appointments/new/prescribe?patientId=${patientId}`}
            size="sm"
          >
            + Write e-Prescription
          </ButtonLink>
        </div>
      </div>

      {/* Patient Clinical Demographics Banner */}
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl sm:text-2xl font-bold text-label">
                {patientProfile.full_name || "Patient Record"}
              </h1>
              <Pill tone="neutral">Patient ID: {patientId.slice(0, 8)}…</Pill>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs sm:text-sm text-label-2">
              {patientProfile.blood_group && (
                <span className="inline-flex items-center gap-1 font-bold text-danger-text bg-danger-soft border border-danger/30 rounded-row px-2 py-0.5">
                  Blood Group: {patientProfile.blood_group}
                </span>
              )}
              {patientProfile.preferred_language && (
                <span>
                  Language:{" "}
                  <strong className="capitalize text-label">
                    {patientProfile.preferred_language}
                  </strong>
                </span>
              )}
              {patientProfile.phone && (
                <span>
                  Phone:{" "}
                  <strong className="text-label">{patientProfile.phone}</strong>
                </span>
              )}
            </div>

            {/* Emergency Contacts */}
            {contacts && contacts.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-label-2">
                <span className="font-semibold text-label">
                  Emergency Contacts:
                </span>
                {contacts.map((c: DbEmergencyContact) => (
                  <span
                    key={c.id}
                    className="rounded-row bg-fill border border-separator px-2 py-0.5"
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
              <div className="rounded-tile border border-danger/40 bg-danger-soft p-3.5 text-xs text-label">
                <div className="flex items-center gap-2 font-bold text-danger-text">
                  <span
                    aria-hidden="true"
                    className="flex h-5 w-5 items-center justify-center rounded-full bg-danger text-white text-[11px]"
                  >
                    !
                  </span>
                  <span>KNOWN PATIENT ALLERGIES</span>
                </div>
                <p className="mt-1 font-semibold text-danger-text text-sm">
                  {patientProfile.allergies.join(", ")}
                </p>
                <p className="mt-1 text-[11px] text-danger-text">
                  Verify contraindicated compounds before prescribing antibiotics or analgesics.
                </p>
              </div>
            ) : (
              <div className="rounded-tile border border-separator bg-fill p-3 text-xs text-label-2">
                <span className="font-semibold text-label">Allergies:</span>{" "}
                No known drug allergies reported by patient.
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Clinical Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-separator overflow-x-auto pb-0.5">
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
                ? "border-accent bg-surface text-accent-strong"
                : "border-transparent text-label-2 hover:text-label hover:bg-fill"
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
              <h2 className="text-base font-bold text-label">
                Active Prescribed Medicines
              </h2>
              <p className="text-xs text-label-3">
                Current active regimens from digital prescriptions and verified records.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={checkInteractionsMutation.isPending}
              onClick={handleCheckInteractions}
            >
              {checkInteractionsMutation.isPending
                ? "Checking Safety…"
                : "Check Drug Interactions"}
            </Button>
          </div>

          {/* Interaction Notice / Results */}
          {interactionNotice && (
            <div className="rounded-tile border border-warn/30 bg-warn-soft p-3.5 text-xs text-label">
              <p className="font-semibold">{interactionNotice}</p>
            </div>
          )}

          {interactionResult && (
            <Card className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-label">
                  Drug Interaction Safety Analysis
                </h3>
                <span className="text-xs text-label-3">
                  Checked {interactionResult.checked_medicines?.length || 0} drugs
                </span>
              </div>

              {interactionResult.interactions?.length === 0 ? (
                <div className="rounded-tile bg-ok-soft border border-ok/20 p-3 text-xs text-ok">
                  No interaction found in:{" "}
                  {interactionResult.sources_checked?.map((s) => s.title).join(", ") || "the checked sources"}.
                  {interactionResult.not_checked && interactionResult.not_checked.length > 0
                    ? ` Not checked: ${interactionResult.not_checked.join(", ")}.`
                    : ""}
                </div>
              ) : (
                <div className="space-y-2">
                  {interactionResult.interactions?.map((it, idx: number) => (
                    <div
                      key={idx}
                      className={`rounded-tile border p-3 text-xs ${
                        it.severity === "major"
                          ? "border-danger/40 bg-danger-soft text-label"
                          : "border-warn/40 bg-warn-soft text-label"
                      }`}
                    >
                      <div className="flex items-center justify-between font-bold">
                        <span>
                          {it.medicine_a} ↔ {it.medicine_b}
                        </span>
                        <span
                          className={`rounded-row px-1.5 py-0.5 text-[11px] font-bold uppercase ${
                            it.severity === "major"
                              ? "bg-danger text-white"
                              : "bg-warn text-white"
                          }`}
                        >
                          {it.severity} risk
                        </span>
                      </div>
                      <p className="mt-1">{it.effect}</p>
                      {it.advice && (
                        <p className="mt-1 font-semibold text-label">
                          Advice: {it.advice}
                        </p>
                      )}
                      {it.quote && (
                        <p className="mt-1.5 italic text-label-2 bg-surface/70 p-1.5 rounded-row">
                          &ldquo;{it.quote}&rdquo;
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {/* Medication Cards */}
          {rxLoading ? (
            <SkeletonCard lines={3} />
          ) : allActiveItems.length === 0 ? (
            <Card className="p-8 text-center text-xs text-label-3">
              No active medications currently registered for this patient.
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {allActiveItems.map((item) => (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-label">
                        {item.medicine_name} {item.strength || ""}
                      </h3>
                      <p className="text-xs text-label-2">
                        {item.form || "Tablet"} · {item.frequency}
                        {item.times && item.times.length > 0
                          ? ` (${item.times.join(", ")})`
                          : ""}
                      </p>
                    </div>
                    <Pill tone="ok">Active</Pill>
                  </div>

                  {item.instructions && (
                    <p className="mt-2 text-xs text-label-2 bg-fill p-2 rounded-row border border-separator">
                      <strong>Instructions:</strong> {item.instructions}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between text-[11px] text-label-3 border-t border-separator pt-2">
                    <span>Quantity: {item.quantity_total || "—"}</span>
                    <span>Started: {item.start_date || "—"}</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Care Plans & Chronic Conditions */}
      {activeTab === "conditions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-label">
              Chronic Care Plans & Disease Management
            </h2>
          </div>

          {carePlansLoading ? (
            <SkeletonCard lines={3} />
          ) : !carePlans || carePlans.length === 0 ? (
            <Card className="p-8 text-center text-xs text-label-3">
              No chronic care plans authored or linked for this patient yet.
            </Card>
          ) : (
            <div className="space-y-3">
              {carePlans.map((cp) => {
                const planDoc = cp.plan_json as unknown as CarePlan | null;
                const isApproved = cp.status === "approved";
                const isDraft = cp.status === "draft";

                return (
                  <Card key={cp.id} className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-separator pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-label">
                            {planDoc?.condition || "Care Plan"}
                          </h3>
                          <Pill
                            tone={isApproved ? "ok" : isDraft ? "warn" : "accent"}
                          >
                            {cp.status}
                          </Pill>
                        </div>
                        <p className="mt-0.5 text-xs text-label-3">
                          {isApproved
                            ? `Approved on ${cp.reviewed_at?.slice(0, 10)}`
                            : "Draft plan pending doctor review"}
                        </p>
                      </div>

                      <ButtonLink
                        href={`/doctor/care-plans/${cp.id}`}
                        variant="secondary"
                        size="sm"
                        className="self-start sm:self-auto"
                      >
                        {isApproved ? "View Plan" : "Review & Approve"}
                      </ButtonLink>
                    </div>

                    {/* Summary & Key Do's */}
                    {planDoc?.summary && (
                      <p className="mt-3 text-xs sm:text-sm text-label-2">
                        {planDoc.summary}
                      </p>
                    )}

                    {planDoc?.do && planDoc.do.length > 0 && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="rounded-tile bg-accent-soft p-3 border border-accent/20">
                          <span className="font-bold text-accent-strong block mb-1">
                            Recommended Actions (Do):
                          </span>
                          <ul className="list-disc pl-4 space-y-0.5 text-label">
                            {planDoc.do.slice(0, 3).map((item: string, i: number) => (
                              <li key={i}>{item}</li>
                            ))}
                          </ul>
                        </div>

                        {planDoc.red_flags && planDoc.red_flags.length > 0 && (
                          <div className="rounded-tile bg-danger-soft p-3 border border-danger/20">
                            <span className="font-bold text-danger-text block mb-1">
                              Emergency Red Flags:
                            </span>
                            <ul className="list-disc pl-4 space-y-0.5 text-label">
                              {planDoc.red_flags.slice(0, 3).map((rf: string, i: number) => (
                                <li key={i}>{rf}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Lab Reports */}
      {activeTab === "labs" && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-label">
            Diagnostic Laboratory Reports
          </h2>

          {labsLoading ? (
            <SkeletonCard lines={3} />
          ) : !labReports || labReports.length === 0 ? (
            <Card className="p-8 text-center text-xs text-label-3">
              No laboratory reports uploaded for this patient.
            </Card>
          ) : (
            <div className="space-y-3">
              {labReports.map((report) => {
                const ext = report.extracted_json as {
                  values?: LabReportVal[];
                } | null;
                const values = ext?.values ?? [];

                return (
                  <Card key={report.id} className="p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-separator pb-2.5">
                      <div>
                        <h3 className="text-sm font-bold text-label">
                          {report.lab_name || "Diagnostic Report"}
                        </h3>
                        <p className="text-xs text-label-3">
                          Report Date: {report.report_date || report.created_at.slice(0, 10)}
                        </p>
                      </div>
                      <Pill tone="neutral">{values.length} tests recorded</Pill>
                    </div>

                    {report.summary && (
                      <p className="mt-2.5 text-xs text-label-2 bg-fill p-2.5 rounded-tile border border-separator">
                        <strong>Clinical Summary:</strong> {report.summary}
                      </p>
                    )}

                    {/* Table of test values */}
                    {values.length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-xs text-label-2 border-collapse">
                          <thead>
                            <tr className="border-b border-separator text-label-3 font-semibold">
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
                                  className={`border-b border-separator ${
                                    isAbnormal ? "bg-danger-soft" : ""
                                  }`}
                                >
                                  <td className="py-1.5 pr-3 font-semibold text-label">
                                    {val.test_name}
                                  </td>
                                  <td className="py-1.5 pr-3 font-bold">
                                    {val.value ?? val.value_text} {val.unit || ""}
                                  </td>
                                  <td className="py-1.5 pr-3 text-label-3">
                                    {val.ref_low != null && val.ref_high != null
                                      ? `${val.ref_low} – ${val.ref_high} ${val.unit || ""}`
                                      : "—"}
                                  </td>
                                  <td className="py-1.5">
                                    {val.flag ? (
                                      <span
                                        className={`rounded-row px-1.5 py-0.5 text-[11px] font-bold uppercase ${
                                          val.flag === "high"
                                            ? "bg-danger-soft text-danger-text"
                                            : val.flag === "low"
                                              ? "bg-warn-soft text-warn"
                                              : "bg-accent-soft text-accent-strong"
                                        }`}
                                      >
                                        {val.flag}
                                      </span>
                                    ) : (
                                      <span className="text-label-3">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Vitals & Trends */}
      {activeTab === "vitals" && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-label">
            Vital Signs & Trend Visualizations
          </h2>

          {vitalsLoading ? (
            <SkeletonCard lines={3} />
          ) : vitals.length === 0 ? (
            <Card className="p-8 text-center text-xs text-label-3">
              No vitals logged for this patient yet.
            </Card>
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
              <Card className="overflow-x-auto p-4">
                <table className="w-full text-left text-xs text-label-2 border-collapse">
                  <thead>
                    <tr className="border-b border-separator text-label-3 font-semibold">
                      <th className="py-2 pr-3">Measured On</th>
                      <th className="py-2 pr-3">Type</th>
                      <th className="py-2 pr-3">Reading</th>
                      <th className="py-2">Unit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vitals.map((v: DbVital) => (
                      <tr key={v.id} className="border-b border-separator">
                        <td className="py-2 pr-3 text-label-3">
                          {v.measured_at.slice(0, 16).replace("T", " ")}
                        </td>
                        <td className="py-2 pr-3 font-semibold capitalize text-label">
                          {v.type.replace("_", " ")}
                        </td>
                        <td className="py-2 pr-3 font-bold text-label">
                          {v.value}
                          {v.value2 != null ? ` / ${v.value2}` : ""}
                        </td>
                        <td className="py-2 text-label-3">{v.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Clinical Timeline */}
      {activeTab === "timeline" && (
        <div className="space-y-4">
          <h2 className="text-base font-bold text-label">
            Chronological Care History
          </h2>

          {timelineLoading ? (
            <SkeletonCard lines={3} />
          ) : !timeline || timeline.length === 0 ? (
            <Card className="p-8 text-center text-xs text-label-3">
              No historical health events recorded.
            </Card>
          ) : (
            <div className="space-y-2 border-l-2 border-accent/30 pl-4 ml-2">
              {timeline.map((entry) => (
                <Card
                  key={`${entry.kind}-${entry.id}`}
                  className="relative p-3.5"
                >
                  <span className="absolute -left-[23px] top-4 h-3 w-3 rounded-full bg-accent ring-4 ring-surface" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-label-3">
                      {entry.date}
                    </span>
                    <span className="rounded-row bg-fill px-2 py-0.5 text-[11px] font-bold uppercase text-label-2">
                      {entry.kind}
                    </span>
                  </div>
                  <h3 className="mt-1 text-sm font-bold text-label">
                    {entry.title}
                  </h3>
                  {entry.subtitle && (
                    <p className="mt-0.5 text-xs text-label-2">
                      {entry.subtitle}
                    </p>
                  )}
                </Card>
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
