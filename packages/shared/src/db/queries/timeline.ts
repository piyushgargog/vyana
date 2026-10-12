// packages/shared/src/db/queries/timeline.ts
// One list of a patient's care history. Owner: Vaibhav Parmar

import { requireUserId, unwrap, type Sb } from "./helpers";

export type TimelineKind = "prescription" | "report" | "appointment" | "condition";

export type TimelineEntry = {
  kind: TimelineKind;
  id: string;
  /** `YYYY-MM-DD` */
  date: string;
  title: string;
  subtitle: string | null;
};

export type TimelineSources = {
  prescriptions: { id: string; issued_on: string; diagnosis: string | null; doctor_name: string | null; source: string }[];
  reports: { id: string; report_date: string | null; created_at: string; lab_name: string | null; summary: string | null }[];
  appointments: {
    id: string;
    appointment_date: string;
    token_no: number;
    status: string;
    reason: string | null;
    hospitals: { name: string } | null;
    departments: { name: string } | null;
  }[];
  conditions: { id: string; diagnosed_on: string | null; created_at: string; name: string; source: string }[];
};

const KIND_ORDER: Record<TimelineKind, number> = { appointment: 0, prescription: 1, report: 2, condition: 3 };

/** Merges the four sources into one list, newest first (same day: appointment, prescription, report, condition). */
export function buildTimeline(sources: TimelineSources): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    ...sources.prescriptions.map((p): TimelineEntry => ({
      kind: "prescription",
      id: p.id,
      date: p.issued_on,
      title: p.diagnosis ? `Prescription: ${p.diagnosis}` : "Prescription",
      subtitle: p.doctor_name ?? (p.source === "upload" ? "Uploaded by you" : null),
    })),
    ...sources.reports.map((r): TimelineEntry => ({
      kind: "report",
      id: r.id,
      date: r.report_date ?? r.created_at.slice(0, 10),
      title: r.lab_name ? `Lab report: ${r.lab_name}` : "Lab report",
      subtitle: r.summary,
    })),
    ...sources.appointments.map((a): TimelineEntry => ({
      kind: "appointment",
      id: a.id,
      date: a.appointment_date,
      title: `Appointment, token ${a.token_no}${a.departments ? `: ${a.departments.name}` : ""}`,
      subtitle: [a.hospitals?.name, a.status].filter(Boolean).join(" · ") || null,
    })),
    ...sources.conditions.map((c): TimelineEntry => ({
      kind: "condition",
      id: c.id,
      date: c.diagnosed_on ?? c.created_at.slice(0, 10),
      title: c.name,
      subtitle: c.source === "doctor" ? "Diagnosed by a doctor" : null,
    })),
  ];
  return entries.sort((a, b) => (a.date === b.date ? KIND_ORDER[a.kind] - KIND_ORDER[b.kind] : a.date < b.date ? 1 : -1));
}

/** The signed-in patient's timeline, or a doctor's or caregiver's view of `patientId`. */
export async function getTimeline(sb: Sb, patientId?: string): Promise<TimelineEntry[]> {
  const id = patientId ?? (await requireUserId(sb));
  const [prescriptions, reports, appointments, conditions] = await Promise.all([
    sb.from("prescriptions").select("id, issued_on, diagnosis, doctor_name, source").eq("patient_id", id),
    sb.from("lab_reports").select("id, report_date, created_at, lab_name, summary").eq("patient_id", id),
    sb.from("appointments").select("id, appointment_date, token_no, status, reason, hospitals(name), departments(name)").eq("patient_id", id),
    sb.from("conditions").select("id, diagnosed_on, created_at, name, source").eq("patient_id", id),
  ]);
  return buildTimeline({
    prescriptions: unwrap(prescriptions),
    reports: unwrap(reports),
    appointments: unwrap(appointments),
    conditions: unwrap(conditions),
  });
}
