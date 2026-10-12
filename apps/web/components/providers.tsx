"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AppProviders,
  CONSENT_VERSION,
  type Database,
  type DbCarePlan,
  type DbCondition,
  type DbEmergencyContact,
  type DbMealLog,
  type DbProfile,
  type DbVital,
  type PrescriptionWithItems,
} from "@vyana/shared";
import { createClient } from "@/lib/supabase/browser";
import {
  DEMO_APPOINTMENTS,
  DEMO_CARE_PLAN,
  DEMO_CONDITIONS,
  DEMO_DOCTORS,
  DEMO_EMERGENCY_CONTACTS,
  DEMO_LAB_REPORTS,
  DEMO_MEALS,
  DEMO_PRESCRIPTIONS,
  DEMO_PROFILE_CAREGIVER,
  DEMO_PROFILE_DOCTOR,
  DEMO_PROFILE_PATIENT,
  DEMO_VITALS,
} from "./health-helpers";

export type DemoRole = "patient" | "doctor" | "caregiver" | "admin";

export interface ToastMessage {
  id: string;
  message: string;
  tone: "success" | "info" | "warning" | "error";
}

interface VyanaWebContextValue {
  useMocks: boolean;
  setUseMocks: (v: boolean) => void;
  hasLiveSupabaseEnv: boolean;
  demoRole: DemoRole;
  setDemoRole: (role: DemoRole) => void;
  consentedVersion: string | null;
  grantLocalConsent: (version?: string) => void;
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;
  profile: DbProfile;
  updateLocalProfile: (patch: Partial<DbProfile>) => void;
  conditions: DbCondition[];
  addLocalCondition: (name: string, notes?: string) => void;
  emergencyContacts: DbEmergencyContact[];
  addLocalEmergencyContact: (contact: {
    name: string;
    phone: string;
    relation: string;
  }) => void;
  removeLocalEmergencyContact: (id: string) => void;
  prescriptions: PrescriptionWithItems[];
  addLocalPrescription: (rx: PrescriptionWithItems) => void;
  appointments: typeof DEMO_APPOINTMENTS;
  addLocalAppointment: (appt: (typeof DEMO_APPOINTMENTS)[number]) => void;
  updateLocalAppointmentStatus: (
    id: string,
    status: "booked" | "confirmed" | "completed" | "cancelled"
  ) => void;
  labReports: typeof DEMO_LAB_REPORTS;
  addLocalLabReport: (report: (typeof DEMO_LAB_REPORTS)[number]) => void;
  carePlan: DbCarePlan;
  updateLocalCarePlan: (patch: Partial<DbCarePlan>) => void;
  vitals: DbVital[];
  addLocalVital: (vital: Omit<DbVital, "id" | "patient_id" | "measured_at" | "created_at">) => void;
  meals: DbMealLog[];
  addLocalMeal: (meal: Omit<DbMealLog, "id" | "patient_id" | "logged_at" | "created_at">) => void;
  doctors: typeof DEMO_DOCTORS;
  updateLocalDoctorVerification: (
    doctorId: string,
    status: "verified" | "unverified" | "rejected",
    regNo?: string,
    council?: string
  ) => void;
  doseStatusMap: Record<string, "pending" | "taken" | "skipped">;
  markLocalDose: (key: string, status: "taken" | "skipped") => void;
  showToast: (message: string, tone?: ToastMessage["tone"]) => void;
}

const VyanaWebContext = createContext<VyanaWebContextValue | null>(null);

function createSafeSupabaseClient(): {
  client: SupabaseClient<Database>;
  hasLiveEnv: boolean;
} {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    try {
      return { client: createClient(), hasLiveEnv: true };
    } catch {
      // Fallback below
    }
  }
  const fallbackClient = createBrowserClient<Database>(
    "https://placeholder.supabase.co",
    "placeholder-anon-key"
  ) as unknown as SupabaseClient<Database>;
  return { client: fallbackClient, hasLiveEnv: false };
}

export function WebAppProviders({ children }: { children: React.ReactNode }) {
  const [{ client: supabase, hasLiveEnv }] = useState(createSafeSupabaseClient);
  const defaultMocks =
    process.env.NEXT_PUBLIC_USE_MOCKS === "true" || !hasLiveEnv;

  const [useMocks, setUseMocks] = useState<boolean>(defaultMocks);
  const [demoRole, setDemoRoleState] = useState<DemoRole>("patient");
  const [consentedVersion, setConsentedVersion] = useState<string | null>(
    CONSENT_VERSION
  );
  const [onboarded, setOnboarded] = useState<boolean>(true);
  const [patientProfile, setPatientProfile] = useState<DbProfile>(DEMO_PROFILE_PATIENT);
  const [doctorProfile, setDoctorProfile] = useState<DbProfile>(DEMO_PROFILE_DOCTOR);
  const [caregiverProfile, setCaregiverProfile] = useState<DbProfile>(
    DEMO_PROFILE_CAREGIVER
  );
  const [conditions, setConditions] = useState<DbCondition[]>(DEMO_CONDITIONS);
  const [emergencyContacts, setEmergencyContacts] = useState<DbEmergencyContact[]>(
    DEMO_EMERGENCY_CONTACTS
  );
  const [prescriptions, setPrescriptions] =
    useState<PrescriptionWithItems[]>(DEMO_PRESCRIPTIONS);
  const [appointments, setAppointments] = useState(DEMO_APPOINTMENTS);
  const [labReports, setLabReports] = useState(DEMO_LAB_REPORTS);
  const [carePlan, setCarePlan] = useState<DbCarePlan>(DEMO_CARE_PLAN);
  const [vitals, setVitals] = useState<DbVital[]>(DEMO_VITALS);
  const [meals, setMeals] = useState<DbMealLog[]>(DEMO_MEALS);
  const [doctors, setDoctors] = useState(DEMO_DOCTORS);
  const [doseStatusMap, setDoseStatusMap] = useState<
    Record<string, "pending" | "taken" | "skipped">
  >({
    "rx-item-1-08:30": "taken",
    "rx-item-2-09:00": "taken",
    "rx-item-1-20:30": "pending",
    "rx-item-3-21:30": "pending",
  });
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (message: string, tone: ToastMessage["tone"] = "info") => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    []
  );

  const profile = useMemo(() => {
    if (demoRole === "doctor" || demoRole === "admin") return doctorProfile;
    if (demoRole === "caregiver") return caregiverProfile;
    return patientProfile;
  }, [demoRole, doctorProfile, caregiverProfile, patientProfile]);

  const setDemoRole = useCallback((role: DemoRole) => {
    setDemoRoleState(role);
  }, []);

  const updateLocalProfile = useCallback(
    (patch: Partial<DbProfile>) => {
      if (demoRole === "doctor" || demoRole === "admin") {
        setDoctorProfile((prev) => ({ ...prev, ...patch }));
      } else if (demoRole === "caregiver") {
        setCaregiverProfile((prev) => ({ ...prev, ...patch }));
      } else {
        setPatientProfile((prev) => ({ ...prev, ...patch }));
      }
      if (
        patch.role === "doctor" ||
        patch.role === "patient" ||
        patch.role === "caregiver"
      ) {
        setDemoRoleState(patch.role);
      }
    },
    [demoRole]
  );

  const grantLocalConsent = useCallback(
    (version: string = CONSENT_VERSION) => {
      setConsentedVersion(version);
      showToast(`Consent recorded (${version}) under DPDP Act 2023`, "success");
    },
    [showToast]
  );

  const addLocalCondition = useCallback((name: string, notes?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setConditions((prev) => [
      ...prev,
      {
        id: `cond-${Date.now()}`,
        patient_id: "demo-patient-asha",
        name: trimmed,
        diagnosed_on: new Date().toISOString().slice(0, 10),
        diagnosed_by: null,
        prescription_id: null,
        source: "self",
        active: true,
        notes: notes ?? null,
        created_at: new Date().toISOString(),
      },
    ]);
  }, []);

  const addLocalEmergencyContact = useCallback(
    (contact: { name: string; phone: string; relation: string }) => {
      setEmergencyContacts((prev) => [
        ...prev,
        {
          id: `ec-${Date.now()}`,
          patient_id: "demo-patient-asha",
          name: contact.name,
          phone: contact.phone,
          relation: contact.relation,
          created_at: new Date().toISOString(),
        },
      ]);
    },
    []
  );

  const removeLocalEmergencyContact = useCallback((id: string) => {
    setEmergencyContacts((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const addLocalPrescription = useCallback((rx: PrescriptionWithItems) => {
    setPrescriptions((prev) => [rx, ...prev]);
  }, []);

  const addLocalAppointment = useCallback(
    (appt: (typeof DEMO_APPOINTMENTS)[number]) => {
      setAppointments((prev) => [appt, ...prev]);
    },
    []
  );

  const updateLocalAppointmentStatus = useCallback(
    (id: string, status: "booked" | "confirmed" | "completed" | "cancelled") => {
      setAppointments((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    },
    []
  );

  const addLocalLabReport = useCallback(
    (report: (typeof DEMO_LAB_REPORTS)[number]) => {
      setLabReports((prev) => [report, ...prev]);
    },
    []
  );

  const updateLocalCarePlan = useCallback((patch: Partial<DbCarePlan>) => {
    setCarePlan((prev) => ({
      ...prev,
      ...patch,
      updated_at: new Date().toISOString(),
    }));
  }, []);

  const addLocalVital = useCallback(
    (vital: Omit<DbVital, "id" | "patient_id" | "measured_at" | "created_at">) => {
      const nowIso = new Date().toISOString();
      setVitals((prev) => [
        ...prev,
        {
          ...vital,
          id: `vital-${Date.now()}`,
          patient_id: "demo-patient-asha",
          measured_at: nowIso,
          created_at: nowIso,
        },
      ]);
    },
    []
  );

  const addLocalMeal = useCallback(
    (meal: Omit<DbMealLog, "id" | "patient_id" | "logged_at" | "created_at">) => {
      const nowIso = new Date().toISOString();
      setMeals((prev) => [
        {
          ...meal,
          id: `meal-${Date.now()}`,
          patient_id: "demo-patient-asha",
          logged_at: nowIso,
          created_at: nowIso,
        },
        ...prev,
      ]);
    },
    []
  );

  const updateLocalDoctorVerification = useCallback(
    (
      doctorId: string,
      status: "verified" | "unverified" | "rejected",
      regNo?: string,
      council?: string
    ) => {
      setDoctors((prev) =>
        prev.map((doc) =>
          doc.id === doctorId
            ? {
                ...doc,
                verification_status: status,
                reg_no: regNo ?? doc.reg_no,
                state_council: council ?? doc.state_council,
              }
            : doc
        )
      );
    },
    []
  );

  const markLocalDose = useCallback(
    (key: string, status: "taken" | "skipped") => {
      setDoseStatusMap((prev) => ({ ...prev, [key]: status }));
    },
    []
  );

  const value = useMemo<VyanaWebContextValue>(
    () => ({
      useMocks,
      setUseMocks,
      hasLiveSupabaseEnv: hasLiveEnv,
      demoRole,
      setDemoRole,
      consentedVersion,
      grantLocalConsent,
      onboarded,
      setOnboarded,
      profile,
      updateLocalProfile,
      conditions,
      addLocalCondition,
      emergencyContacts,
      addLocalEmergencyContact,
      removeLocalEmergencyContact,
      prescriptions,
      addLocalPrescription,
      appointments,
      addLocalAppointment,
      updateLocalAppointmentStatus,
      labReports,
      addLocalLabReport,
      carePlan,
      updateLocalCarePlan,
      vitals,
      addLocalVital,
      meals,
      addLocalMeal,
      doctors,
      updateLocalDoctorVerification,
      doseStatusMap,
      markLocalDose,
      showToast,
    }),
    [
      useMocks,
      hasLiveEnv,
      demoRole,
      setDemoRole,
      consentedVersion,
      grantLocalConsent,
      onboarded,
      profile,
      updateLocalProfile,
      conditions,
      addLocalCondition,
      emergencyContacts,
      addLocalEmergencyContact,
      removeLocalEmergencyContact,
      prescriptions,
      addLocalPrescription,
      appointments,
      addLocalAppointment,
      updateLocalAppointmentStatus,
      labReports,
      addLocalLabReport,
      carePlan,
      updateLocalCarePlan,
      vitals,
      addLocalVital,
      meals,
      addLocalMeal,
      doctors,
      updateLocalDoctorVerification,
      doseStatusMap,
      markLocalDose,
      showToast,
    ]
  );

  return (
    <AppProviders supabase={supabase} apiBaseUrl="" useMocks={useMocks}>
      <VyanaWebContext.Provider value={value}>
        {children}
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none"
        >
          {toasts.map((t) => (
            <div
              key={t.id}
              className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium shadow-lg border transition-all ${
                t.tone === "success"
                  ? "bg-teal-900 text-white border-teal-700"
                  : t.tone === "error"
                    ? "bg-red-900 text-white border-red-700"
                    : t.tone === "warning"
                      ? "bg-amber-900 text-white border-amber-700"
                      : "bg-slate-900 text-white border-slate-700"
              }`}
            >
              {t.message}
            </div>
          ))}
        </div>
      </VyanaWebContext.Provider>
    </AppProviders>
  );
}

export function useVyanaWeb(): VyanaWebContextValue {
  const ctx = useContext(VyanaWebContext);
  if (!ctx) {
    throw new Error("useVyanaWeb must be used within <WebAppProviders>");
  }
  return ctx;
}
