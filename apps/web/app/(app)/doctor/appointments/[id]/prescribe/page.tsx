"use client";

import React, { Suspense, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_TIMES,
  useCreateDoctorPrescription,
  useGenerateCarePlan,
  usePrescriptions,
  useUpdateAppointment,
  type DbProfile,
  type DoctorPrescriptionItem,
  type FrequencyType,
  type InteractionsRes,
} from "@vyana/shared";
import { useVyanaWeb } from "@/components/providers";
import { SkeletonCard } from "@/components/ui-primitives";

interface PrescribeFormItem extends DoctorPrescriptionItem {
  id: string; // client temporary ID
}

interface AppointmentDetails {
  id: string;
  patient_id: string;
  token_no: number;
  appointment_date: string;
  patient?: DbProfile | null;
  departments?: { name: string } | null;
  hospitals?: { name: string } | null;
}

function DoctorPrescribeContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: appointmentIdParam } = use(params);
  const searchParams = useSearchParams();
  const queryPatientId = searchParams.get("patientId");
  const router = useRouter();
  const { supabase, showToast } = useVyanaWeb();

  const isNewAppointment = appointmentIdParam === "new";

  const [appointment, setAppointment] = useState<AppointmentDetails | null>(null);
  const [apptLoading, setApptLoading] = useState(!isNewAppointment);
  const [apptError, setApptError] = useState<string | null>(null);

  const [directPatientProfile, setDirectPatientProfile] = useState<DbProfile | null>(null);
  const [patientLoading, setPatientLoading] = useState(false);

  useEffect(() => {
    if (isNewAppointment) return;
    let ignore = false;
    async function loadAppt() {
      try {
        const { data, error } = await supabase
          .from("appointments")
          .select(
            "*, patient:profiles!appointments_patient_id_fkey(*), departments(name), hospitals(name)"
          )
          .eq("id", appointmentIdParam)
          .maybeSingle();
        if (ignore) return;
        if (error) throw error;
        setAppointment(data as AppointmentDetails | null);
      } catch (err) {
        if (!ignore) {
          setApptError(err instanceof Error ? err.message : "Failed to load appointment");
        }
      } finally {
        if (!ignore) {
          setApptLoading(false);
        }
      }
    }
    loadAppt();
    return () => {
      ignore = true;
    };
  }, [appointmentIdParam, isNewAppointment, supabase]);

  const effectivePatientId =
    appointment?.patient_id || queryPatientId || "";

  useEffect(() => {
    if (!effectivePatientId || appointment?.patient) return;
    let ignore = false;
    async function loadPatient() {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", effectivePatientId)
          .maybeSingle();
        if (ignore) return;
        if (error) throw error;
        setDirectPatientProfile(data as DbProfile | null);
      } catch {
        // non-critical fallback
      } finally {
        if (!ignore) {
          setPatientLoading(false);
        }
      }
    }
    loadPatient();
    return () => {
      ignore = true;
    };
  }, [appointment?.patient, effectivePatientId, supabase]);

  const patient = appointment?.patient || directPatientProfile;

  // Active medicines of the patient to check polypharmacy interactions
  const { data: existingPrescriptions } = usePrescriptions(
    effectivePatientId || undefined
  );
  const existingActiveItems = (existingPrescriptions ?? [])
    .flatMap((p) => p.prescription_items ?? [])
    .filter((it) => it.active);

  // Form State
  const [diagnosis, setDiagnosis] = useState("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [medicines, setMedicines] = useState<PrescribeFormItem[]>([
    {
      id: "med-1",
      medicine_name: "",
      strength: "",
      dose: "1 tablet",
      form: "tablet",
      frequency: "OD",
      times: DEFAULT_TIMES.OD ? [...DEFAULT_TIMES.OD] : ["09:00"],
      with_food: "after",
      instructions: "Take after breakfast with water",
      quantity_total: 30,
      duration_days: 30,
      refill_alert_days: undefined,
      start_date: new Date().toISOString().slice(0, 10),
      end_date: null,
      active: true,
    },
  ]);

  // Drug Interaction Checking State
  const [interactionResult] = useState<InteractionsRes | null>(null);
  const [interactionNotice, setInteractionNotice] = useState<string | null>(null);

  // Pipeline execution state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pipelineStep, setPipelineStep] = useState<string>("");

  const createRxMutation = useCreateDoctorPrescription();
  const generateCarePlanMutation = useGenerateCarePlan();
  const updateAppointmentMutation = useUpdateAppointment();

  // Add a new medicine card
  const handleAddMedicine = () => {
    setMedicines((prev) => [
      ...prev,
      {
        id: `med-${Date.now()}`,
        medicine_name: "",
        strength: "",
        dose: "1 tablet",
        form: "tablet",
        frequency: "OD",
        times: DEFAULT_TIMES.OD ? [...DEFAULT_TIMES.OD] : ["09:00"],
        with_food: "after",
        instructions: "Take after meals",
        quantity_total: 30,
        duration_days: 30,
        refill_alert_days: undefined,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: null,
        active: true,
      },
    ]);
  };

  const handleRemoveMedicine = (id: string) => {
    if (medicines.length === 1) {
      showToast("Prescription must include at least one medicine", "warning");
      return;
    }
    setMedicines((prev) => prev.filter((m) => m.id !== id));
  };

  const handleUpdateMedicine = (
    id: string,
    field: keyof DoctorPrescriptionItem,
    value: unknown
  ) => {
    setMedicines((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const updated = { ...item, [field]: value };
        // If frequency changed, sync default times (BD gets 2 times, SOS gets [])
        if (field === "frequency") {
          const freq = value as FrequencyType;
          if (freq in DEFAULT_TIMES) {
            updated.times = [...DEFAULT_TIMES[freq]];
          }
        }
        return updated;
      })
    );
  };

  // Run Drug Interaction Checker
  const handleCheckInteractions = () => {
    const validNames = medicines
      .map((m) => m.medicine_name.trim())
      .filter(Boolean);

    if (validNames.length === 0) {
      showToast("Please enter medicine names before checking interactions", "warning");
      return;
    }

    setInteractionNotice(
      "The interaction check is not available on this screen yet."
    );
  };

  // Submit Prescription and trigger Care Plan Generation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!effectivePatientId) {
      showToast("Cannot prescribe: missing patient reference", "error");
      return;
    }

    if (!diagnosis.trim()) {
      showToast("Clinical diagnosis is required", "warning");
      return;
    }

    const invalidMed = medicines.find((m) => !m.medicine_name.trim());
    if (invalidMed) {
      showToast("All medicines must have a valid medicine name", "warning");
      return;
    }

    setIsSubmitting(true);
    setPipelineStep("Validating and storing e-prescription in patient record…");

    try {
      // 1. Prepare items payload
      const cleanedItems: DoctorPrescriptionItem[] = medicines.map((m) => {
        const freq = m.frequency as FrequencyType;
        const defaultTimes = freq in DEFAULT_TIMES ? DEFAULT_TIMES[freq] : [];
        const times = m.times && m.times.length > 0 ? m.times : defaultTimes;
        return {
          medicine_name: m.medicine_name.trim(),
          strength: m.strength?.trim() || null,
          dose: m.dose?.trim() || null,
          form: m.form || "tablet",
          frequency: m.frequency,
          times,
          with_food: m.with_food || "after",
          instructions: m.instructions?.trim() || null,
          quantity_total: m.quantity_total ? Number(m.quantity_total) : null,
          duration_days: m.duration_days ? Number(m.duration_days) : null,
          refill_alert_days:
            m.refill_alert_days != null ? Number(m.refill_alert_days) : undefined,
          start_date: m.start_date || new Date().toISOString().slice(0, 10),
          end_date: m.end_date || null,
          active: true,
        };
      });

      // 2. Call createDoctorPrescription (transaction creates prescription, items, and condition)
      const res = await createRxMutation.mutateAsync({
        patient_id: effectivePatientId,
        appointment_id: !isNewAppointment ? appointmentIdParam : null,
        diagnosis: diagnosis.trim(),
        notes: clinicalNotes.trim() || null,
        items: cleanedItems,
      });

      showToast("E-Prescription saved successfully!", "success");

      // 3. Mark appointment completed if there was an appointment
      if (!isNewAppointment && appointment) {
        try {
          await updateAppointmentMutation.mutateAsync({
            id: appointment.id,
            status: "completed",
            doctor_notes: `Diagnosed: ${diagnosis.trim()}`,
          });
        } catch {
          // non-blocking
        }
      }

      // 4. Trigger Care Plan Generation if condition_id was returned
      if (res.condition_id) {
        setPipelineStep(
          "Prescription saved! Generating AI draft care plan from diagnosis guidelines… (up to ~1 min)"
        );
        try {
          const carePlanRes = await generateCarePlanMutation.mutateAsync({
            condition_id: res.condition_id,
          });
          showToast("AI draft care plan generated!", "success");
          if (carePlanRes.care_plan_id) {
            router.push(`/doctor/care-plans/${carePlanRes.care_plan_id}`);
          } else {
            router.push("/doctor");
          }
          return;
        } catch (carePlanErr) {
          showToast(
            "Prescription saved. Care plan generation queued: " +
              (carePlanErr instanceof Error ? carePlanErr.message : "check care plans tab"),
            "info"
          );
          router.push("/doctor");
          return;
        }
      } else {
        router.push("/doctor");
      }
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to save e-prescription",
        "error"
      );
      setIsSubmitting(false);
      setPipelineStep("");
    }
  };

  if (apptLoading || patientLoading) {
    return (
      <div className="space-y-4">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={4} />
      </div>
    );
  }

  if (!isNewAppointment && apptError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-900">
        <h2 className="text-base font-bold">Appointment record not found</h2>
        <p className="mt-1 text-xs">{apptError}</p>
        <Link
          href="/doctor"
          className="mt-4 inline-block rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white"
        >
          Return to Queue
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/doctor"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-teal-800 hover:text-teal-900"
        >
          ← Return to OPD Queue
        </Link>
        {effectivePatientId && (
          <Link
            href={`/doctor/patients/${effectivePatientId}`}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            View Patient History
          </Link>
        )}
      </div>

      {/* Patient Clinical Context Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-700 text-white font-bold text-sm">
                Rx
              </span>
              <div>
                <h1 className="text-xl font-bold text-slate-900">
                  Write Digital E-Prescription
                </h1>
                <p className="text-xs text-slate-500">
                  Official clinical prescription with automatic condition registration and care plan drafting
                </p>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-700">
              <span className="font-bold text-slate-900">
                Patient: {patient?.full_name || "Patient Record"}
              </span>
              {appointment && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">
                  Token #{appointment.token_no} · {appointment.appointment_date}
                </span>
              )}
              {patient?.blood_group && (
                <span className="rounded-md bg-red-50 border border-red-200 px-2 py-0.5 font-bold text-red-700">
                  Blood Group: {patient.blood_group}
                </span>
              )}
            </div>
          </div>

          {/* Allergies Notice */}
          <div className="w-full sm:w-72 shrink-0">
            {patient?.allergies && (Array.isArray(patient.allergies) ? patient.allergies.length > 0 : Boolean(patient.allergies)) ? (
              <div className="rounded-xl border border-red-300 bg-red-50 p-3 text-xs text-red-950">
                <span className="font-bold text-red-800 block">
                  Patient Allergies Alert:
                </span>
                <span className="font-semibold text-red-900">
                  {Array.isArray(patient.allergies) ? patient.allergies.join(", ") : patient.allergies}
                </span>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-600">
                No drug allergies on record.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Prescription Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Diagnosis & Clinical Notes Section */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-sm space-y-4">
          <div>
            <label
              htmlFor="rx-diagnosis"
              className="block text-xs font-bold uppercase tracking-wider text-slate-800 mb-1"
            >
              Clinical Diagnosis <span className="text-red-600">* (Required)</span>
            </label>
            <input
              id="rx-diagnosis"
              type="text"
              required
              value={diagnosis}
              onChange={(e) => setDiagnosis(e.target.value)}
              placeholder="e.g. Type 2 Diabetes Mellitus, Essential Hypertension, Upper Respiratory Tract Infection"
              className="w-full rounded-xl border border-slate-300 p-3 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-teal-800">
              Saving this diagnosis automatically records the chronic condition and generates an AI draft care plan for your review.
            </p>
          </div>

          <div>
            <label
              htmlFor="rx-clinical-notes"
              className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1"
            >
              Doctor Clinical Notes & Advice (Optional)
            </label>
            <textarea
              id="rx-clinical-notes"
              rows={2}
              value={clinicalNotes}
              onChange={(e) => setClinicalNotes(e.target.value)}
              placeholder="General patient instructions, dietary restrictions, follow-up date…"
              className="w-full rounded-xl border border-slate-300 p-3 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-accent"
            />
          </div>
        </div>

        {/* Existing Medications Warning Bar */}
        {existingActiveItems.length > 0 && (
          <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3.5 text-xs text-blue-950">
            <span className="font-bold text-blue-900">
              Current Patient Medications on Record:
            </span>
            <span className="ml-1 text-blue-800">
              {existingActiveItems.map((m) => m.medicine_name).join(", ")}
            </span>
          </div>
        )}

        {/* Medication Builder Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Prescribed Medicines ({medicines.length})
            </h2>
            <p className="text-xs text-slate-500">
              Specify dosage, frequency, and reminder schedule for home pharmacy fulfillment and dose tracking.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCheckInteractions}
              className="rounded-xl border border-amber-300 bg-amber-50 px-3.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition shadow-xs"
            >
              Check Interactions
            </button>
            <button
              type="button"
              onClick={handleAddMedicine}
              className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-slate-800 transition shadow-xs"
            >
              + Add Medicine
            </button>
          </div>
        </div>

        {/* Drug Interactions Feedback Card */}
        {interactionNotice && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
            <p className="font-semibold">{interactionNotice}</p>
          </div>
        )}

        {interactionResult && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Drug Interaction Analysis
              </h3>
              <span className="text-[11px] text-slate-500">
                {interactionResult.interactions?.length || 0} interaction(s) found
              </span>
            </div>

            {interactionResult.not_checked &&
              interactionResult.not_checked.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                  <span>Not checked (unknown salt/formulation): </span>
                  <span className="font-semibold">
                    {interactionResult.not_checked.join(", ")}
                  </span>
                </div>
              )}

            {interactionResult.interactions?.length === 0 ? (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-2.5 text-xs text-slate-700">
                No drug-drug interactions detected in checked sources.
              </div>
            ) : (
              interactionResult.interactions?.map((it, i) => (
                <div
                  key={i}
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
                    <div className="flex items-center gap-1.5">
                      {it.layer && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                          Layer: {it.layer}
                        </span>
                      )}
                      <span className="uppercase text-[11px] px-1.5 py-0.5 rounded bg-white/80">
                        {it.severity}
                      </span>
                    </div>
                  </div>
                  <p className="mt-1">{it.effect}</p>
                  {it.advice && <p className="mt-1 font-semibold">{it.advice}</p>}
                  {it.quote && (
                    <p className="mt-1 text-[11px] italic text-slate-600 bg-white/50 p-1.5 rounded border border-slate-200">
                      &ldquo;{it.quote}&rdquo;
                    </p>
                  )}
                  {it.sources && it.sources.length > 0 && (
                    <div className="mt-1.5 text-[11px] text-slate-500">
                      <span>Sources: </span>
                      {it.sources.map((src, sIdx) => (
                        <a
                          key={sIdx}
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-700 underline mr-2 hover:text-teal-900"
                        >
                          {src.title}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}

            {interactionResult.sources_checked &&
              interactionResult.sources_checked.length > 0 && (
                <div className="text-[11px] text-slate-500 pt-1 border-t border-slate-100">
                  <span>Sources checked: </span>
                  {interactionResult.sources_checked.map((s, idx) => (
                    <a
                      key={idx}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-700 underline mr-2 hover:text-teal-900"
                    >
                      {s.title}
                    </a>
                  ))}
                </div>
              )}
          </div>
        )}

        {/* Medicine Rows */}
        <div className="space-y-4">
          {medicines.map((med, idx) => (
            <div
              key={med.id}
              className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <span className="text-xs font-bold text-teal-800">
                  Medicine #{idx + 1}
                </span>
                {medicines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMedicine(med.id)}
                    className="text-xs font-semibold text-red-600 hover:text-red-800"
                  >
                    Remove
                  </button>
                )}
              </div>

              {/* Row 1: Name, Strength, Form */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor={`${med.id}-medicine-name`} className="block text-[11px] font-bold text-slate-700 mb-1">
                    Medicine Name *
                  </label>
                  <input
                    id={`${med.id}-medicine-name`}
                    type="text"
                    required
                    value={med.medicine_name}
                    onChange={(e) =>
                      handleUpdateMedicine(med.id, "medicine_name", e.target.value)
                    }
                    placeholder="e.g. Metformin, Paracetamol, Telmisartan"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs sm:text-sm text-slate-900 outline-none focus:border-accent"
                  />
                </div>

                <div>
                  <label htmlFor={`${med.id}-strength`} className="block text-[11px] font-bold text-slate-700 mb-1">
                    Strength / Dose
                  </label>
                  <input
                    id={`${med.id}-strength`}
                    type="text"
                    value={med.strength || ""}
                    onChange={(e) =>
                      handleUpdateMedicine(med.id, "strength", e.target.value)
                    }
                    placeholder="e.g. 500 mg, 10 mg"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs sm:text-sm text-slate-900 outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Row 2: Form, Frequency, Food Timing */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor={`${med.id}-form`} className="block text-[11px] font-bold text-slate-700 mb-1">
                    Form
                  </label>
                  <select
                    id={`${med.id}-form`}
                    value={med.form}
                    onChange={(e) =>
                      handleUpdateMedicine(med.id, "form", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 outline-none focus:border-accent"
                  >
                    <option value="tablet">Tablet</option>
                    <option value="capsule">Capsule</option>
                    <option value="syrup">Syrup</option>
                    <option value="injection">Injection</option>
                    <option value="drop">Drop</option>
                    <option value="ointment">Ointment</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`${med.id}-frequency`} className="block text-[11px] font-bold text-slate-700 mb-1">
                    Frequency
                  </label>
                  <select
                    id={`${med.id}-frequency`}
                    value={med.frequency}
                    onChange={(e) =>
                      handleUpdateMedicine(med.id, "frequency", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 outline-none focus:border-accent"
                  >
                    <option value="OD">OD — Once Daily (09:00)</option>
                    <option value="BD">BD — Twice Daily (09:00, 21:00)</option>
                    <option value="TDS">TDS — Thrice Daily (08:00, 14:00, 20:00)</option>
                    <option value="QID">QID — Four Times (08:00, 12:00, 16:00, 20:00)</option>
                    <option value="HS">HS — Bedtime (22:00)</option>
                    <option value="SOS">SOS — As Needed</option>
                    <option value="custom">Custom Schedule</option>
                  </select>
                </div>

                <div>
                  <label htmlFor={`${med.id}-with-food`} className="block text-[11px] font-bold text-slate-700 mb-1">
                    Relation to Food
                  </label>
                  <select
                    id={`${med.id}-with-food`}
                    value={med.with_food}
                    onChange={(e) =>
                      handleUpdateMedicine(med.id, "with_food", e.target.value)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white p-2 text-xs text-slate-900 outline-none focus:border-accent"
                  >
                    <option value="after">After Food</option>
                    <option value="before">Before Food / Empty Stomach</option>
                    <option value="any">Any / With Water</option>
                  </select>
                </div>
              </div>

              {/* Row 3: Instructions & Quantity */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label htmlFor={`${med.id}-instructions`} className="block text-[11px] font-bold text-slate-700 mb-1">
                    Patient Instructions
                  </label>
                  <input
                    id={`${med.id}-instructions`}
                    type="text"
                    value={med.instructions || ""}
                    onChange={(e) =>
                      handleUpdateMedicine(med.id, "instructions", e.target.value)
                    }
                    placeholder="e.g. Take with warm water after dinner"
                    className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 outline-none focus:border-accent"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label htmlFor={`${med.id}-quantity-total`} className="block text-[11px] font-bold text-slate-700 mb-1">
                      Total Units
                    </label>
                    <input
                      id={`${med.id}-quantity-total`}
                      type="number"
                      min="1"
                      value={med.quantity_total ?? ""}
                      onChange={(e) =>
                        handleUpdateMedicine(
                          med.id,
                          "quantity_total",
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 outline-none focus:border-accent"
                    />
                  </div>
                  <div>
                    <label htmlFor={`${med.id}-duration-days`} className="block text-[11px] font-bold text-slate-700 mb-1">
                      Days
                    </label>
                    <input
                      id={`${med.id}-duration-days`}
                      type="number"
                      min="1"
                      value={med.duration_days ?? ""}
                      onChange={(e) =>
                        handleUpdateMedicine(
                          med.id,
                          "duration_days",
                          parseInt(e.target.value) || 0
                        )
                      }
                      className="w-full rounded-xl border border-slate-300 p-2 text-xs text-slate-900 outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Pipeline Execution Banner */}
        {isSubmitting && (
          <div className="rounded-2xl border border-teal-300 bg-teal-50 p-4 text-xs text-teal-950 flex items-center gap-3">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-teal-700 border-t-transparent" />
            <span className="font-semibold">{pipelineStep}</span>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-slate-200 pt-5">
          <Link
            href="/doctor"
            className="w-full sm:w-auto text-center rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full sm:w-auto rounded-xl bg-teal-700 px-6 py-2.5 text-xs font-bold text-white hover:bg-teal-800 transition shadow-md disabled:opacity-60"
          >
            {isSubmitting ? "Processing…" : "Issue Prescription & Generate Care Plan"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function DoctorPrescribePage(props: {
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
      <DoctorPrescribeContent {...props} />
    </Suspense>
  );
}
