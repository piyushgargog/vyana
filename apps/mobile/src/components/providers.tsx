import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  AppProviders,
  CONSENT_VERSION,
  type Database,
  type DbCarePlan,
  type DbCondition,
  type DbDrugAlert,
  type DbEmergencyContact,
  type DbMealLog,
  type DbProfile,
  type DbVital,
  type PrescriptionWithItems,
} from '@vyana/shared';
import {
  DEMO_APPOINTMENTS,
  DEMO_CARE_PLAN,
  DEMO_CONDITIONS,
  DEMO_DRUG_ALERTS,
  DEMO_EMERGENCY_CONTACTS,
  DEMO_LAB_REPORTS,
  DEMO_MEALS,
  DEMO_PRESCRIPTIONS,
  DEMO_PROFILE_CAREGIVER,
  DEMO_PROFILE_PATIENT,
  DEMO_VITALS,
} from './health-helpers';

export type MobileRole = 'patient' | 'caregiver' | 'doctor';

export interface MobileToast {
  id: string;
  message: string;
  tone: 'success' | 'info' | 'warning' | 'error';
}

interface VyanaMobileContextValue {
  useMocks: boolean;
  setUseMocks: (v: boolean) => void;
  hasLiveSupabaseEnv: boolean;
  supabase: SupabaseClient<Database>;
  baseUrl: string;
  role: MobileRole;
  setRole: (role: MobileRole) => void;
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
  toggleLocalPrescriptionItem: (
    rxId: string,
    itemId: string,
    active: boolean
  ) => void;
  appointments: typeof DEMO_APPOINTMENTS;
  addLocalAppointment: (appt: (typeof DEMO_APPOINTMENTS)[number]) => void;
  cancelLocalAppointment: (id: string) => void;
  labReports: typeof DEMO_LAB_REPORTS;
  addLocalLabReport: (report: (typeof DEMO_LAB_REPORTS)[number]) => void;
  carePlan: DbCarePlan;
  updateLocalCarePlan: (patch: Partial<DbCarePlan>) => void;
  vitals: DbVital[];
  addLocalVital: (
    vital: Omit<DbVital, 'id' | 'patient_id' | 'measured_at' | 'created_at'>
  ) => void;
  meals: DbMealLog[];
  addLocalMeal: (
    meal: Omit<DbMealLog, 'id' | 'patient_id' | 'logged_at' | 'created_at'>
  ) => void;
  drugAlerts: DbDrugAlert[];
  markLocalAlertSeen: (id: string) => void;
  doseStatusMap: Record<string, 'pending' | 'taken' | 'skipped'>;
  markLocalDose: (key: string, status: 'taken' | 'skipped') => void;
  selectedBasketMedicines: {
    name: string;
    strength?: string;
    quantity: number;
  }[];
  setSelectedBasketMedicines: (
    items: { name: string; strength?: string; quantity: number }[]
  ) => void;
  showToast: (message: string, tone?: MobileToast['tone']) => void;
}

const VyanaMobileContext = createContext<VyanaMobileContextValue | null>(null);

function createSafeMobileSupabase(): {
  client: SupabaseClient<Database>;
  hasLiveEnv: boolean;
} {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) {
    return {
      client: createClient<Database>(url, key, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }),
      hasLiveEnv: true,
    };
  }
  return {
    client: createClient<Database>(
      'https://placeholder.supabase.co',
      'placeholder-anon-key',
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      }
    ),
    hasLiveEnv: false,
  };
}

export function MobileAppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  const [{ client: supabase, hasLiveEnv }] = useState(createSafeMobileSupabase);
  const baseUrl =
    process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';
  const defaultMocks =
    process.env.EXPO_PUBLIC_USE_MOCKS === 'true' || !hasLiveEnv;

  const [useMocks, setUseMocks] = useState<boolean>(defaultMocks);
  const [role, setRole] = useState<MobileRole>('patient');
  const [consentedVersion, setConsentedVersion] = useState<string | null>(
    CONSENT_VERSION
  );
  const [onboarded, setOnboarded] = useState<boolean>(true);
  const [patientProfile, setPatientProfile] =
    useState<DbProfile>(DEMO_PROFILE_PATIENT);
  const [caregiverProfile, setCaregiverProfile] = useState<DbProfile>(
    DEMO_PROFILE_CAREGIVER
  );
  const [conditions, setConditions] = useState<DbCondition[]>(DEMO_CONDITIONS);
  const [emergencyContacts, setEmergencyContacts] = useState<
    DbEmergencyContact[]
  >(DEMO_EMERGENCY_CONTACTS);
  const [prescriptions, setPrescriptions] =
    useState<PrescriptionWithItems[]>(DEMO_PRESCRIPTIONS);
  const [appointments, setAppointments] = useState(DEMO_APPOINTMENTS);
  const [labReports, setLabReports] = useState(DEMO_LAB_REPORTS);
  const [carePlan, setCarePlan] = useState<DbCarePlan>(DEMO_CARE_PLAN);
  const [vitals, setVitals] = useState<DbVital[]>(DEMO_VITALS);
  const [meals, setMeals] = useState<DbMealLog[]>(DEMO_MEALS);
  const [drugAlerts, setDrugAlerts] =
    useState<DbDrugAlert[]>(DEMO_DRUG_ALERTS);
  const [doseStatusMap, setDoseStatusMap] = useState<
    Record<string, 'pending' | 'taken' | 'skipped'>
  >({
    'rx-item-1-08:30': 'taken',
    'rx-item-2-09:00': 'taken',
    'rx-item-1-20:30': 'pending',
    'rx-item-3-21:30': 'pending',
  });
  const [selectedBasketMedicines, setSelectedBasketMedicines] = useState<
    { name: string; strength?: string; quantity: number }[]
  >([
    { name: 'Metformin', strength: '500mg', quantity: 60 },
    { name: 'Telmisartan', strength: '40mg', quantity: 30 },
    { name: 'Atorvastatin', strength: '10mg', quantity: 30 },
  ]);
  const [toasts, setToasts] = useState<MobileToast[]>([]);

  const showToast = useCallback(
    (message: string, tone: MobileToast['tone'] = 'info') => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, message, tone }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3800);
    },
    []
  );

  const profile = useMemo(
    () => (role === 'caregiver' ? caregiverProfile : patientProfile),
    [role, caregiverProfile, patientProfile]
  );

  const updateLocalProfile = useCallback(
    (patch: Partial<DbProfile>) => {
      if (role === 'caregiver') {
        setCaregiverProfile((prev) => ({ ...prev, ...patch }));
      } else {
        setPatientProfile((prev) => ({ ...prev, ...patch }));
      }
      if (
        patch.role === 'patient' ||
        patch.role === 'caregiver' ||
        patch.role === 'doctor'
      ) {
        setRole(patch.role);
      }
    },
    [role]
  );

  const grantLocalConsent = useCallback(
    (version: string = CONSENT_VERSION) => {
      setConsentedVersion(version);
      showToast(`DPDP Consent (${version}) recorded`, 'success');
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
        patient_id: 'demo-patient-asha',
        name: trimmed,
        diagnosed_on: new Date().toISOString().slice(0, 10),
        diagnosed_by: null,
        prescription_id: null,
        source: 'self',
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
          patient_id: 'demo-patient-asha',
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

  const toggleLocalPrescriptionItem = useCallback(
    (rxId: string, itemId: string, active: boolean) => {
      setPrescriptions((prev) =>
        prev.map((rx) =>
          rx.id === rxId
            ? {
                ...rx,
                prescription_items: rx.prescription_items.map((item) =>
                  item.id === itemId ? { ...item, active } : item
                ),
              }
            : rx
        )
      );
    },
    []
  );

  const addLocalAppointment = useCallback(
    (appt: (typeof DEMO_APPOINTMENTS)[number]) => {
      setAppointments((prev) => [appt, ...prev]);
    },
    []
  );

  const cancelLocalAppointment = useCallback((id: string) => {
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, status: 'cancelled' as const } : a
      )
    );
  }, []);

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
    (
      vital: Omit<DbVital, 'id' | 'patient_id' | 'measured_at' | 'created_at'>
    ) => {
      const nowIso = new Date().toISOString();
      setVitals((prev) => [
        ...prev,
        {
          ...vital,
          id: `vital-${Date.now()}`,
          patient_id: 'demo-patient-asha',
          measured_at: nowIso,
          created_at: nowIso,
        },
      ]);
    },
    []
  );

  const addLocalMeal = useCallback(
    (
      meal: Omit<DbMealLog, 'id' | 'patient_id' | 'logged_at' | 'created_at'>
    ) => {
      const nowIso = new Date().toISOString();
      setMeals((prev) => [
        {
          ...meal,
          id: `meal-${Date.now()}`,
          patient_id: 'demo-patient-asha',
          logged_at: nowIso,
          created_at: nowIso,
        },
        ...prev,
      ]);
    },
    []
  );

  const markLocalAlertSeen = useCallback((id: string) => {
    setDrugAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, seen: true } : a))
    );
  }, []);

  const markLocalDose = useCallback(
    (key: string, status: 'taken' | 'skipped') => {
      setDoseStatusMap((prev) => ({ ...prev, [key]: status }));
    },
    []
  );

  const value = useMemo<VyanaMobileContextValue>(
    () => ({
      useMocks,
      setUseMocks,
      hasLiveSupabaseEnv: hasLiveEnv,
      supabase,
      baseUrl,
      role,
      setRole,
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
      toggleLocalPrescriptionItem,
      appointments,
      addLocalAppointment,
      cancelLocalAppointment,
      labReports,
      addLocalLabReport,
      carePlan,
      updateLocalCarePlan,
      vitals,
      addLocalVital,
      meals,
      addLocalMeal,
      drugAlerts,
      markLocalAlertSeen,
      doseStatusMap,
      markLocalDose,
      selectedBasketMedicines,
      setSelectedBasketMedicines,
      showToast,
    }),
    [
      useMocks,
      hasLiveEnv,
      supabase,
      baseUrl,
      role,
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
      toggleLocalPrescriptionItem,
      appointments,
      addLocalAppointment,
      cancelLocalAppointment,
      labReports,
      addLocalLabReport,
      carePlan,
      updateLocalCarePlan,
      vitals,
      addLocalVital,
      meals,
      addLocalMeal,
      drugAlerts,
      markLocalAlertSeen,
      doseStatusMap,
      markLocalDose,
      selectedBasketMedicines,
      showToast,
    ]
  );

  return (
    <AppProviders supabase={supabase} apiBaseUrl={baseUrl} useMocks={useMocks}>
      <VyanaMobileContext.Provider value={value}>
        {children}
        {toasts.length > 0 && (
          <View
            accessibilityLiveRegion="polite"
            style={styles.toastContainer}
            pointerEvents="none"
          >
            {toasts.map((t) => (
              <View
                key={t.id}
                style={[
                  styles.toastCard,
                  t.tone === 'success'
                    ? styles.toastSuccess
                    : t.tone === 'error'
                      ? styles.toastError
                      : t.tone === 'warning'
                        ? styles.toastWarning
                        : styles.toastInfo,
                ]}
              >
                <Text style={styles.toastText}>{t.message}</Text>
              </View>
            ))}
          </View>
        )}
      </VyanaMobileContext.Provider>
    </AppProviders>
  );
}

export function useVyanaMobile(): VyanaMobileContextValue {
  const ctx = useContext(VyanaMobileContext);
  if (!ctx) {
    throw new Error(
      'useVyanaMobile must be used within <MobileAppProviders>'
    );
  }
  return ctx;
}

const styles = StyleSheet.create({
  toastContainer: {
    position: 'absolute',
    bottom: 92,
    left: 16,
    right: 16,
    zIndex: 999,
    gap: 8,
  },
  toastCard: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 8,
    elevation: 4,
  },
  toastSuccess: {
    backgroundColor: '#115E59',
  },
  toastError: {
    backgroundColor: '#991B1B',
  },
  toastWarning: {
    backgroundColor: '#92400E',
  },
  toastInfo: {
    backgroundColor: '#0F172A',
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
});
