import type {
  DbAppointment,
  DbCarePlan,
  DbCondition,
  DbDoctor,
  DbDrugAlert,
  DbEmergencyContact,
  DbHospital,
  DbLabReport,
  DbLabValue,
  DbMealLog,
  DbPrescriptionItem,
  DbProfile,
  DbVital,
  PrescriptionWithItems,
  TimelineEntry,
} from "@vyana/shared";

export interface RefillStatus {
  daysLeft: number;
  refillDate: Date;
  needsRefillSoon: boolean;
}

export function parseDailyDoses(frequency: string | null | undefined): number {
  if (!frequency) return 1;
  const normalized = frequency.trim().toLowerCase();
  if (
    normalized === "thrice_daily" ||
    normalized.includes("tds") ||
    normalized.includes("tid") ||
    normalized === "1-1-1"
  ) {
    return 3;
  }
  if (
    normalized === "twice_daily" ||
    normalized.includes("bd") ||
    normalized.includes("bid") ||
    normalized.includes("twice") ||
    normalized === "1-0-1"
  ) {
    return 2;
  }
  if (normalized === "four_times_daily" || normalized.includes("qid") || normalized === "1-1-1-1") {
    return 4;
  }
  if (normalized === "as_needed" || normalized.includes("sos") || normalized.includes("prn")) {
    return 0.5;
  }
  const parts = normalized.split("-").map((n) => Number.parseInt(n, 10));
  if (parts.length >= 2 && parts.every((n) => !Number.isNaN(n))) {
    const sum = parts.reduce((acc, v) => acc + v, 0);
    if (sum > 0) return sum;
  }
  return 1;
}

export function getRefillStatus(
  item: Pick<
    DbPrescriptionItem,
    "duration_days" | "quantity_total" | "frequency" | "start_date" | "created_at" | "refill_alert_days"
  >,
  adherenceCount = 0
): RefillStatus {
  const dailyDoses = parseDailyDoses(item.frequency);
  const totalDays =
    typeof item.duration_days === "number" && item.duration_days > 0
      ? item.duration_days
      : typeof item.quantity_total === "number" && item.quantity_total > 0
        ? Math.ceil(item.quantity_total / Math.max(dailyDoses, 1))
        : 30;

  const startStr = item.start_date || item.created_at;
  const startDate = startStr ? new Date(startStr) : new Date();
  const now = new Date();
  const elapsedMs = Math.max(0, now.getTime() - startDate.getTime());
  const elapsedDays = Math.floor(elapsedMs / (1000 * 60 * 60 * 24));
  const consumedDays =
    adherenceCount > 0
      ? Math.max(elapsedDays, Math.floor(adherenceCount / Math.max(dailyDoses, 1)))
      : elapsedDays;

  const daysLeft = Math.max(0, totalDays - consumedDays);
  const refillDate = new Date(now.getTime() + daysLeft * 24 * 60 * 60 * 1000);
  const alertThreshold =
    typeof item.refill_alert_days === "number" && item.refill_alert_days > 0
      ? item.refill_alert_days
      : 5;

  return {
    daysLeft,
    refillDate,
    needsRefillSoon: daysLeft <= alertThreshold,
  };
}

export interface MedicalIdQrPayload {
  v: 1;
  name: string;
  dob: string | null;
  bloodGroup: string | null;
  allergies: string[];
  conditions: string[];
  activeMeds: string[];
  emergencyContact: {
    name: string;
    phone: string;
    relation?: string | null;
  } | null;
  shareUrl?: string;
}

export function buildMedicalIdQr(
  profile: Pick<DbProfile, "full_name" | "dob" | "blood_group" | "allergies">,
  conditions: Array<Pick<DbCondition, "name">>,
  activeMeds: Array<Pick<DbPrescriptionItem, "medicine_name" | "strength">>,
  emergencyContact?: Pick<DbEmergencyContact, "name" | "phone" | "relation"> | null,
  shareUrl?: string
): string {
  const payload: MedicalIdQrPayload = {
    v: 1,
    name: profile.full_name || "Vyana Patient",
    dob: profile.dob ?? null,
    bloodGroup: profile.blood_group ?? null,
    allergies: profile.allergies ?? [],
    conditions: conditions.map((c) => c.name),
    activeMeds: activeMeds.map((m) =>
      m.strength ? `${m.medicine_name} ${m.strength}` : m.medicine_name
    ),
    emergencyContact: emergencyContact
      ? {
          name: emergencyContact.name,
          phone: emergencyContact.phone,
          relation: emergencyContact.relation ?? null,
        }
      : null,
    ...(shareUrl ? { shareUrl } : {}),
  };
  return JSON.stringify(payload);
}

export function parseMedicalIdQr(qrString: string): MedicalIdQrPayload | null {
  try {
    const parsed = JSON.parse(qrString) as Partial<MedicalIdQrPayload>;
    if (parsed && parsed.v === 1 && typeof parsed.name === "string") {
      return {
        v: 1,
        name: parsed.name,
        dob: parsed.dob ?? null,
        bloodGroup: parsed.bloodGroup ?? null,
        allergies: Array.isArray(parsed.allergies) ? parsed.allergies : [],
        conditions: Array.isArray(parsed.conditions) ? parsed.conditions : [],
        activeMeds: Array.isArray(parsed.activeMeds) ? parsed.activeMeds : [],
        emergencyContact: parsed.emergencyContact ?? null,
        shareUrl: parsed.shareUrl,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function generateQrMatrix(data: string, size = 25): boolean[][] {
  const matrix: boolean[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => false)
  );

  const drawFinder = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const isBorder = r === 0 || r === 6 || c === 0 || c === 6;
        const isInner = r >= 2 && r <= 4 && c >= 2 && c <= 4;
        matrix[r0 + r][c0 + c] = isBorder || isInner;
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  let hash = 2166136261;
  for (let i = 0; i < data.length; i++) {
    hash ^= data.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  let idx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const inTopLeft = r < 8 && c < 8;
      const inTopRight = r < 8 && c >= size - 8;
      const inBottomLeft = r >= size - 8 && c < 8;
      const isTiming = r === 6 || c === 6;
      if (inTopLeft || inTopRight || inBottomLeft || isTiming) continue;

      const charCode = data.charCodeAt(idx % Math.max(1, data.length)) || 42;
      const bit = ((charCode + r * 31 + c * 17 + (hash >>> (idx % 16))) & 1) === 1;
      matrix[r][c] = bit;
      idx++;
    }
  }

  return matrix;
}

export interface CarePlanContent {
  title: string;
  summary: string;
  do_list: string[];
  dont_list: string[];
  diet_notes: string;
  exercise_notes: string;
  red_flags: string[];
  follow_up_tests: Array<{ test: string; due_in_days: number }>;
  sources: Array<{ title: string; url: string }>;
}

export const DEMO_CARE_PLAN_CONTENT: CarePlanContent = {
  title: "Type 2 Diabetes & Hypertension Daily Care Plan",
  summary:
    "Structured Indian glycemic & blood-pressure management routine tailored around Metformin 500mg twice daily and Telmisartan 40mg once daily.",
  do_list: [
    "Take Metformin 500mg within 15 minutes after breakfast and dinner with a full glass of water.",
    "Walk briskly for 30 minutes daily (15 minutes after lunch and 15 minutes after dinner).",
    "Check fasting blood glucose twice a week and home BP every Monday and Thursday morning.",
    "Inspect both feet daily for cuts, blisters, redness, or numbness.",
  ],
  dont_list: [
    "Do not skip meals after taking diabetes medication to prevent hypoglycemia.",
    "Avoid refined sugar, sweetened chai, fruit juices, white bread, and deep-fried snacks.",
    "Limit table salt intake to less than 5g (1 level teaspoon) per day for blood pressure control.",
  ],
  diet_notes:
    "Prefer whole-grain rotis (multigrain/jowar/bajra), dal, palak, methi, lauki, karela, sprouts, and unsweetened curd. Replace white rice with small portions of hand-pounded brown rice or millets.",
  exercise_notes:
    "30–40 minutes of brisk walking + 10 minutes of gentle pranayama (Anulom Vilom). Carry 2 glucose tablets or 15g sugar sachet during walks.",
  red_flags: [
    "Blood sugar below 70 mg/dL with sweating, shakiness, dizziness, or confusion (follow Rule of 15 immediately).",
    "Fasting blood sugar persistently above 250 mg/dL or blood pressure above 180/110 mmHg.",
    "Chest pain, shortness of breath, sudden vision blurring, or non-healing foot ulcer.",
  ],
  follow_up_tests: [
    { test: "HbA1c", due_in_days: 90 },
    { test: "Fasting & Post-Prandial Blood Glucose", due_in_days: 30 },
    { test: "Kidney Function Test (Serum Creatinine & Urine Microalbumin)", due_in_days: 180 },
    { test: "Dilated Retinal Eye Exam", due_in_days: 180 },
  ],
  sources: [
    {
      title: "ICMR Standard Treatment Workflow — Type 2 Diabetes Mellitus",
      url: "https://stw.icmr.org.in",
    },
    {
      title: "RSSDI Clinical Practice Recommendations for Diabetes in India",
      url: "https://www.rssdi.in",
    },
  ],
};

export function extractCarePlanContent(plan: DbCarePlan | null | undefined): CarePlanContent {
  if (!plan || !plan.plan_json || typeof plan.plan_json !== "object" || Array.isArray(plan.plan_json)) {
    return DEMO_CARE_PLAN_CONTENT;
  }
  const raw = plan.plan_json as Record<string, unknown>;
  return {
    title: typeof raw.title === "string" ? raw.title : DEMO_CARE_PLAN_CONTENT.title,
    summary: typeof raw.summary === "string" ? raw.summary : DEMO_CARE_PLAN_CONTENT.summary,
    do_list: Array.isArray(raw.do_list)
      ? (raw.do_list as string[])
      : Array.isArray(raw.dos)
        ? (raw.dos as string[])
        : DEMO_CARE_PLAN_CONTENT.do_list,
    dont_list: Array.isArray(raw.dont_list)
      ? (raw.dont_list as string[])
      : Array.isArray(raw.donts)
        ? (raw.donts as string[])
        : DEMO_CARE_PLAN_CONTENT.dont_list,
    diet_notes:
      typeof raw.diet_notes === "string"
        ? raw.diet_notes
        : typeof raw.diet === "string"
          ? raw.diet
          : DEMO_CARE_PLAN_CONTENT.diet_notes,
    exercise_notes:
      typeof raw.exercise_notes === "string"
        ? raw.exercise_notes
        : DEMO_CARE_PLAN_CONTENT.exercise_notes,
    red_flags: Array.isArray(raw.red_flags)
      ? (raw.red_flags as string[])
      : DEMO_CARE_PLAN_CONTENT.red_flags,
    follow_up_tests: Array.isArray(raw.follow_up_tests)
      ? (raw.follow_up_tests as Array<{ test: string; due_in_days: number }>)
      : DEMO_CARE_PLAN_CONTENT.follow_up_tests,
    sources: Array.isArray(raw.sources)
      ? (raw.sources as Array<{ title: string; url: string }>)
      : DEMO_CARE_PLAN_CONTENT.sources,
  };
}

export const DEMO_PROFILE_PATIENT: DbProfile = {
  id: "demo-patient-asha",
  role: "patient",
  full_name: "Asha Devi",
  phone: "+91 98111 22334",
  dob: "1968-04-12",
  gender: "female",
  blood_group: "B+",
  allergies: ["Penicillin", "Sulfa drugs"],
  preferred_language: "en",
  city: "New Delhi",
  onboarded: true,
  created_at: "2026-01-15T09:00:00Z",
};

export const DEMO_PROFILE_DOCTOR: DbProfile = {
  id: "demo-doctor-priya",
  role: "doctor",
  full_name: "Dr. Priya Sharma",
  phone: "+91 98111 55667",
  dob: "1982-08-21",
  gender: "female",
  blood_group: "O+",
  allergies: [],
  preferred_language: "en",
  city: "New Delhi",
  onboarded: true,
  created_at: "2026-01-10T09:00:00Z",
};

export const DEMO_PROFILE_CAREGIVER: DbProfile = {
  id: "demo-caregiver-rohit",
  role: "caregiver",
  full_name: "Rohit Verma",
  phone: "+91 98111 99887",
  dob: "1994-11-03",
  gender: "male",
  blood_group: "A+",
  allergies: [],
  preferred_language: "en",
  city: "New Delhi",
  onboarded: true,
  created_at: "2026-01-18T09:00:00Z",
};

export const DEMO_CONDITIONS: DbCondition[] = [
  {
    id: "cond-t2d",
    patient_id: "demo-patient-asha",
    name: "Type 2 Diabetes Mellitus",
    diagnosed_on: "2022-05-10",
    diagnosed_by: "doc-aiims-1",
    prescription_id: "rx-demo-1",
    source: "doctor",
    active: true,
    notes: "On Metformin + Glimepiride; target HbA1c < 7.0%",
    created_at: "2026-01-15T09:00:00Z",
  },
  {
    id: "cond-htn",
    patient_id: "demo-patient-asha",
    name: "Essential Hypertension",
    diagnosed_on: "2023-02-18",
    diagnosed_by: "doc-aiims-1",
    prescription_id: "rx-demo-1",
    source: "doctor",
    active: true,
    notes: "On Telmisartan 40mg OD; home BP monitoring advised",
    created_at: "2026-01-15T09:00:00Z",
  },
];

export const DEMO_EMERGENCY_CONTACTS: DbEmergencyContact[] = [
  {
    id: "ec-1",
    patient_id: "demo-patient-asha",
    name: "Rohit Verma (Son)",
    phone: "+919811199887",
    relation: "Son",
    created_at: "2026-01-15T09:00:00Z",
  },
  {
    id: "ec-2",
    patient_id: "demo-patient-asha",
    name: "Sunita Verma (Daughter-in-law)",
    phone: "+919811144556",
    relation: "Daughter-in-law",
    created_at: "2026-01-15T09:00:00Z",
  },
];

export const DEMO_PRESCRIPTIONS: PrescriptionWithItems[] = [
  {
    id: "rx-demo-1",
    patient_id: "demo-patient-asha",
    doctor_id: "doc-aiims-1",
    doctor_name: "Dr. Priya Sharma (AIIMS Medicine OPD)",
    appointment_id: "appt-demo-1",
    diagnosis: "Type 2 Diabetes Mellitus & Essential Hypertension",
    issued_on: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    file_path: null,
    notes: "Continue low-glycemic diet; repeat HbA1c and KFT in 3 months.",
    source: "doctor",
    created_at: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString(),
    prescription_items: [
      {
        id: "rx-item-1",
        prescription_id: "rx-demo-1",
        patient_id: "demo-patient-asha",
        medicine_name: "Metformin",
        strength: "500mg",
        form: "tablet",
        dose: "1 tablet",
        frequency: "twice_daily",
        times: ["08:30", "20:30"],
        with_food: "after_food",
        duration_days: 30,
        quantity_total: 60,
        refill_alert_days: 5,
        start_date: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        end_date: null,
        instructions: "Take after breakfast and dinner",
        active: true,
        created_at: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "rx-item-2",
        prescription_id: "rx-demo-1",
        patient_id: "demo-patient-asha",
        medicine_name: "Telmisartan",
        strength: "40mg",
        form: "tablet",
        dose: "1 tablet",
        frequency: "once_daily",
        times: ["09:00"],
        with_food: "after_food",
        duration_days: 30,
        quantity_total: 30,
        refill_alert_days: 5,
        start_date: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        end_date: null,
        instructions: "Take every morning after breakfast",
        active: true,
        created_at: new Date(Date.now() - 27 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "rx-item-3",
        prescription_id: "rx-demo-1",
        patient_id: "demo-patient-asha",
        medicine_name: "Atorvastatin",
        strength: "10mg",
        form: "tablet",
        dose: "1 tablet",
        frequency: "once_daily",
        times: ["21:30"],
        with_food: "after_food",
        duration_days: 30,
        quantity_total: 30,
        refill_alert_days: 5,
        start_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        end_date: null,
        instructions: "Take at bedtime",
        active: true,
        created_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];

export const DEMO_HOSPITALS: DbHospital[] = [
  {
    id: "hosp-aiims-delhi",
    name: "All India Institute of Medical Sciences (AIIMS)",
    kind: "government",
    address: "Sri Aurobindo Marg, Ansari Nagar, New Delhi 110029",
    city: "New Delhi",
    phone: "+91-11-26588500",
    website: "https://www.aiims.edu",
    ors_enabled: true,
    pmjay_empanelled: true,
    lat: 28.5672,
    lng: 77.21,
    opd_info: { registration_window: "08:00-11:00" },
    opd_info_fetched_at: "2026-04-01T08:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "hosp-safdarjung",
    name: "VMMC & Safdarjung Hospital",
    kind: "government",
    address: "Ring Road, Ansari Nagar West, New Delhi 110029",
    city: "New Delhi",
    phone: "+91-11-26730000",
    website: "https://vmmc-sjh.mohfw.gov.in",
    ors_enabled: true,
    pmjay_empanelled: true,
    lat: 28.5685,
    lng: 77.2058,
    opd_info: { registration_window: "08:00-11:30" },
    opd_info_fetched_at: "2026-04-01T08:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "hosp-rml",
    name: "Atal Bihari Vajpayee Institute & Dr. RML Hospital",
    kind: "government",
    address: "Baba Kharak Singh Marg, Connaught Place, New Delhi 110001",
    city: "New Delhi",
    phone: "+91-11-23365525",
    website: "https://rmlh.nic.in",
    ors_enabled: true,
    pmjay_empanelled: true,
    lat: 28.6256,
    lng: 77.2019,
    opd_info: { registration_window: "08:30-11:30" },
    opd_info_fetched_at: "2026-04-01T08:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "hosp-apollo-delhi",
    name: "Indraprastha Apollo Hospital",
    kind: "private",
    address: "Sarita Vihar, Delhi Mathura Road, New Delhi 110076",
    city: "New Delhi",
    phone: "+91-11-26925858",
    website: "https://www.apollohospitals.com/delhi",
    ors_enabled: false,
    pmjay_empanelled: true,
    lat: 28.5403,
    lng: 77.2833,
    opd_info: { registration_window: "09:00-17:00" },
    opd_info_fetched_at: "2026-04-01T08:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
  },
  {
    id: "hosp-max-saket",
    name: "Max Super Speciality Hospital, Saket",
    kind: "private",
    address: "1, 2, Press Enclave Road, Saket, New Delhi 110017",
    city: "New Delhi",
    phone: "+91-11-26515050",
    website: "https://www.maxhealthcare.in",
    ors_enabled: false,
    pmjay_empanelled: false,
    lat: 28.5276,
    lng: 77.2121,
    opd_info: { registration_window: "09:00-18:00" },
    opd_info_fetched_at: "2026-04-01T08:00:00Z",
    created_at: "2026-01-01T00:00:00Z",
  },
];

export const DEMO_DOCTORS: Array<
  DbDoctor & {
    full_name: string;
    hospital_name: string;
    department_name: string;
  }
> = [
  {
    id: "doc-aiims-1",
    hospital_id: "hosp-aiims-delhi",
    department_id: "dept-aiims-medicine",
    full_name: "Dr. Priya Sharma",
    specialization: "General Medicine & Diabetology",
    reg_no: "DMC-45892",
    state_council: "Delhi Medical Council",
    year_of_registration: 2010,
    verification_status: "verified",
    verified_at: "2026-02-01T10:00:00Z",
    verification_json: {
      reg_no: "DMC-45892",
      council: "Delhi Medical Council",
      year: 2010,
    },
    clinic_name: "AIIMS Medicine OPD Block B",
    clinic_address: "Ansari Nagar, New Delhi",
    consultation_fee: 0,
    availability: { mon_sat: "09:00-13:00" },
    created_at: "2026-01-01T00:00:00Z",
    hospital_name: "All India Institute of Medical Sciences (AIIMS)",
    department_name: "General Medicine OPD",
  },
  {
    id: "doc-aiims-2",
    hospital_id: "hosp-aiims-delhi",
    department_id: "dept-aiims-cardio",
    full_name: "Dr. Rajeshwar Rao",
    specialization: "Cardiology",
    reg_no: "DMC-31204",
    state_council: "Delhi Medical Council",
    year_of_registration: 2006,
    verification_status: "verified",
    verified_at: "2026-02-01T10:00:00Z",
    verification_json: {
      reg_no: "DMC-31204",
      council: "Delhi Medical Council",
      year: 2006,
    },
    clinic_name: "AIIMS Cardiothoracic Centre",
    clinic_address: "Ansari Nagar, New Delhi",
    consultation_fee: 0,
    availability: { mon_fri: "09:00-13:00" },
    created_at: "2026-01-01T00:00:00Z",
    hospital_name: "All India Institute of Medical Sciences (AIIMS)",
    department_name: "Cardiology OPD",
  },
  {
    id: "doc-apollo-1",
    hospital_id: "hosp-apollo-delhi",
    department_id: "dept-apollo-endo",
    full_name: "Dr. Ananya Nair",
    specialization: "Endocrinology",
    reg_no: "KMC-77410",
    state_council: "Karnataka Medical Council",
    year_of_registration: 2015,
    verification_status: "unverified",
    verified_at: null,
    verification_json: null,
    clinic_name: "Apollo Sugar & Endocrine Clinic",
    clinic_address: "Sarita Vihar, New Delhi",
    consultation_fee: 1200,
    availability: { mon_sat: "10:00-16:00" },
    created_at: "2026-01-01T00:00:00Z",
    hospital_name: "Indraprastha Apollo Hospital",
    department_name: "Endocrinology & Diabetes",
  },
];

export const DEMO_APPOINTMENTS: Array<
  DbAppointment & {
    hospital_name: string;
    department_name: string;
    doctor_name: string;
    opd_hours: string;
    patient_name: string;
  }
> = [
  {
    id: "appt-demo-1",
    patient_id: "demo-patient-asha",
    hospital_id: "hosp-aiims-delhi",
    department_id: "dept-aiims-medicine",
    doctor_id: "doc-aiims-1",
    appointment_date: new Date().toISOString().slice(0, 10),
    scheduled_at: null,
    token_no: 14,
    status: "confirmed",
    reason: "3-month Diabetes & BP review with HbA1c report",
    doctor_notes: "Bring fasting blood sugar log and previous OPD card",
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    hospital_name: "All India Institute of Medical Sciences (AIIMS)",
    department_name: "General Medicine OPD",
    doctor_name: "Dr. Priya Sharma",
    opd_hours: "09:00 - 11:00",
    patient_name: "Asha Devi",
  },
  {
    id: "appt-demo-2",
    patient_id: "demo-patient-rajesh",
    hospital_id: "hosp-aiims-delhi",
    department_id: "dept-aiims-medicine",
    doctor_id: "doc-aiims-1",
    appointment_date: new Date().toISOString().slice(0, 10),
    scheduled_at: null,
    token_no: 15,
    status: "booked",
    reason: "Post-discharge follow-up for hypertension and lipid profile",
    doctor_notes: "Check postural BP",
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    hospital_name: "All India Institute of Medical Sciences (AIIMS)",
    department_name: "General Medicine OPD",
    doctor_name: "Dr. Priya Sharma",
    opd_hours: "09:00 - 11:00",
    patient_name: "Rajesh Kumar",
  },
];

export const DEMO_LAB_REPORTS: Array<
  DbLabReport & { report_title: string; values: DbLabValue[] }
> = [
  {
    id: "lab-demo-1",
    patient_id: "demo-patient-asha",
    report_title: "Comprehensive Metabolic & Glycemic Panel (HbA1c, Fasting Glucose, Lipid)",
    lab_name: "SRL Diagnostics — Green Park, New Delhi",
    report_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    file_path: "reports/demo-patient-asha/hba1c-panel.pdf",
    status: "analyzed",
    summary:
      "Your HbA1c is 7.4% (down from 8.2% three months ago), showing steady improvement on Metformin 500mg twice daily. Fasting blood glucose is mildly elevated at 132 mg/dL. LDL cholesterol is well controlled at 88 mg/dL.",
    extracted_json: null,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    values: [
      {
        id: "lv-1",
        report_id: "lab-demo-1",
        patient_id: "demo-patient-asha",
        test_name: "HbA1c",
        value: 7.4,
        value_text: "7.4",
        unit: "%",
        ref_low: 4.0,
        ref_high: 5.6,
        flag: "high",
        measured_on: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "lv-2",
        report_id: "lab-demo-1",
        patient_id: "demo-patient-asha",
        test_name: "Fasting Blood Glucose",
        value: 132,
        value_text: "132",
        unit: "mg/dL",
        ref_low: 70,
        ref_high: 100,
        flag: "high",
        measured_on: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "lv-3",
        report_id: "lab-demo-1",
        patient_id: "demo-patient-asha",
        test_name: "LDL Cholesterol",
        value: 88,
        value_text: "88",
        unit: "mg/dL",
        ref_low: 0,
        ref_high: 100,
        flag: "normal",
        measured_on: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "lv-4",
        report_id: "lab-demo-1",
        patient_id: "demo-patient-asha",
        test_name: "Serum Creatinine",
        value: 0.85,
        value_text: "0.85",
        unit: "mg/dL",
        ref_low: 0.6,
        ref_high: 1.1,
        flag: "normal",
        measured_on: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
  },
];

export const DEMO_HBA1C_HISTORY: DbLabValue[] = [
  {
    id: "lv-hist-1",
    report_id: "lab-old-1",
    patient_id: "demo-patient-asha",
    test_name: "HbA1c",
    value: 8.8,
    value_text: "8.8",
    unit: "%",
    ref_low: 4.0,
    ref_high: 5.6,
    flag: "high",
    measured_on: "2025-10-12",
    created_at: "2025-10-12T10:00:00Z",
  },
  {
    id: "lv-hist-2",
    report_id: "lab-old-2",
    patient_id: "demo-patient-asha",
    test_name: "HbA1c",
    value: 8.2,
    value_text: "8.2",
    unit: "%",
    ref_low: 4.0,
    ref_high: 5.6,
    flag: "high",
    measured_on: "2026-01-14",
    created_at: "2026-01-14T10:00:00Z",
  },
  {
    id: "lv-hist-3",
    report_id: "lab-demo-1",
    patient_id: "demo-patient-asha",
    test_name: "HbA1c",
    value: 7.4,
    value_text: "7.4",
    unit: "%",
    ref_low: 4.0,
    ref_high: 5.6,
    flag: "high",
    measured_on: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const DEMO_CARE_PLAN: DbCarePlan = {
  id: "cp-demo-t2d",
  patient_id: "demo-patient-asha",
  condition_id: "cond-t2d",
  language: "en",
  status: "approved",
  plan_json: DEMO_CARE_PLAN_CONTENT as unknown as DbCarePlan["plan_json"],
  reviewed_by: "doc-aiims-1",
  reviewed_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  updated_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
};

export const DEMO_VITALS: DbVital[] = [
  {
    id: "vital-1",
    patient_id: "demo-patient-asha",
    type: "bp",
    value: 136,
    value2: 86,
    unit: "mmHg",
    measured_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "vital-2",
    patient_id: "demo-patient-asha",
    type: "bp",
    value: 128,
    value2: 82,
    unit: "mmHg",
    measured_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "vital-3",
    patient_id: "demo-patient-asha",
    type: "bp",
    value: 124,
    value2: 80,
    unit: "mmHg",
    measured_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "vital-4",
    patient_id: "demo-patient-asha",
    type: "glucose_fasting",
    value: 134,
    value2: null,
    unit: "mg/dL",
    measured_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "vital-5",
    patient_id: "demo-patient-asha",
    type: "glucose_fasting",
    value: 118,
    value2: null,
    unit: "mg/dL",
    measured_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const DEMO_MEALS: DbMealLog[] = [
  {
    id: "meal-1",
    patient_id: "demo-patient-asha",
    meal: "breakfast",
    description: "2 moong dal chilla with mint chutney + unsweetened masala chai",
    calories: 320,
    logged_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "meal-2",
    patient_id: "demo-patient-asha",
    meal: "lunch",
    description: "2 multigrain rotis, palak dal, lauki sabzi, cucumber kachumber salad, 1 bowl curd",
    calories: 460,
    logged_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
];

export const DEMO_DRUG_ALERTS: DbDrugAlert[] = [
  {
    id: "alert-cdsco-1",
    patient_id: "demo-patient-asha",
    medicine_name: "Telmisartan 40mg",
    title: "CDSCO Monthly NSQ Alert — Batch TLM-2409B (Sample Pharma Pvt Ltd)",
    snippet:
      "Batch TLM-2409B failed dissolution test in routine statutory sampling. Check the batch number printed on your blister strip.",
    url: "https://cdsco.gov.in/opencms/opencms/en/Notifications/Alerts/",
    seen: false,
    created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const DEMO_TIMELINE: TimelineEntry[] = [
  {
    kind: "appointment",
    id: "appt-demo-1",
    date: new Date().toISOString().slice(0, 10),
    title: "Appointment, token 14: General Medicine OPD",
    subtitle: "All India Institute of Medical Sciences (AIIMS) · confirmed",
  },
  {
    kind: "report",
    id: "lab-demo-1",
    date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    title: "Lab report: SRL Diagnostics — Green Park, New Delhi",
    subtitle: "HbA1c 7.4% (High), Fasting Glucose 132 mg/dL (High), LDL 88 mg/dL (Normal)",
  },
  {
    kind: "prescription",
    id: "rx-demo-1",
    date: new Date(Date.now() - 26 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    title: "Prescription: Type 2 Diabetes Mellitus & Essential Hypertension",
    subtitle: "Dr. Priya Sharma (AIIMS) · Metformin 500mg, Telmisartan 40mg, Atorvastatin 10mg",
  },
  {
    kind: "condition",
    id: "cond-t2d",
    date: "2022-05-10",
    title: "Type 2 Diabetes Mellitus",
    subtitle: "Diagnosed by a doctor",
  },
];
