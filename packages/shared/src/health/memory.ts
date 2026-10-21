// packages/shared/src/health/memory.ts
// The Health Memory Graph of a shared record (issue #237): the long view behind a share link —
// lab trends, vital lines, medicines over time and the last 30 days of doses. Pure functions:
// the server fetches the rows (capped, only for the scopes that are on) and passes `today`
// (the day in India) in, so every boundary below can be tested without a clock.
// Owner: Vaibhav Parmar

import type { ShareMemory, ShareScope } from "../contracts";
import { addDays, formatLocalDate, parseLocalDate } from "./dates";

/** The parts of a record a share link can carry (the words of migration 0014 and the contracts). */
export const SHARE_SCOPES = ["labs", "vitals", "medicines", "adherence"] as const;

export function isShareScope(value: string): value is ShareScope {
  return (SHARE_SCOPES as readonly string[]).includes(value);
}

/** The caps of #237: at most this many lab tests, points per test, and months of history. */
export const MEMORY_LAB_TESTS = 24;
export const MEMORY_LAB_POINTS = 24;
export const MEMORY_LAB_MONTHS = 24;
export const MEMORY_VITAL_MONTHS = 12;
export const MEMORY_ADHERENCE_DAYS = 30;

/** One lab value as the server read it (a row of `lab_values`). */
export interface MemoryLabValue {
  test_name: string;
  value: number | null;
  value_text: string | null;
  unit: string | null;
  flag: string;
  ref_low: number | null;
  ref_high: number | null;
  measured_on: string | null;
}

/** One reading as the server read it (a row of `vitals`). */
export interface MemoryVital {
  type: string;
  value: number;
  value2: number | null;
  unit: string;
  measured_at: string;
}

/** One medicine as the server read it (a row of `prescription_items`). */
export interface MemoryMedicineItem {
  medicine_name: string;
  strength: string | null;
  dose: string | null;
  frequency: string;
  created_at: string;
  end_date: string | null;
}

/** One logged dose as the server read it (a row of `dose_logs`). */
export interface MemoryDoseLog {
  scheduled_for: string;
  status: string;
}

export interface MemorySources {
  labs: MemoryLabValue[];
  vitals: MemoryVital[];
  medicines: MemoryMedicineItem[];
  adherence: MemoryDoseLog[];
}

/** A lab flag as the shared page colours it; anything the database holds outside these reads as "unknown". */
export type MemoryLabFlag = "low" | "normal" | "high" | "unknown";

export interface MemoryLabPoint {
  date: string;
  value: number | null;
  value_text: string | null;
  flag: MemoryLabFlag;
  ref_low: number | null;
  ref_high: number | null;
}
export interface MemoryLabTest {
  test_name: string;
  unit: string | null;
  points: MemoryLabPoint[];
}
export interface MemoryVitalPoint {
  date: string;
  value: number;
  value2: number | null;
}
export interface MemoryVitalSeries {
  type: string;
  unit: string;
  points: MemoryVitalPoint[];
}
export interface MemoryMedicine {
  name: string;
  strength: string | null;
  dose: string | null;
  frequency: string;
  /** The day the medicine was added (in India); `to` is its last day, or null while it runs. */
  from: string;
  to: string | null;
}
export interface MemoryAdherenceDay {
  date: string;
  taken: number;
  missed: number;
  skipped: number;
}
export interface MemoryAdherence {
  /** Every day of the window, oldest first — a day with no doses logged reads as zeroes. */
  days: MemoryAdherenceDay[];
  /** Taken of all the doses that were logged in the window (taken + missed + skipped), or null when none were. */
  percent: number | null;
}

/** The calendar day (`YYYY-MM-DD`) `months` months before `date`. */
function monthsAgo(date: string, months: number): string {
  const d = parseLocalDate(date);
  d.setMonth(d.getMonth() - months);
  return formatLocalDate(d);
}

/** The day in India that a timestamp falls on. India is UTC+5:30 all year (no daylight saving). */
function istDateOf(timestamp: string): string {
  return new Date(new Date(timestamp).getTime() + (5 * 60 + 30) * 60 * 1000).toISOString().slice(0, 10);
}

/** A flag from the database as a `MemoryLabFlag` (the column's check already holds it to these four). */
function labFlag(flag: string): MemoryLabFlag {
  return flag === "low" || flag === "normal" || flag === "high" ? flag : "unknown";
}

function buildLabs(values: MemoryLabValue[], today: string): MemoryLabTest[] {
  const cutoff = monthsAgo(today, MEMORY_LAB_MONTHS);
  const byTest = new Map<string, MemoryLabValue[]>();
  for (const v of values) {
    if (!v.measured_on || v.measured_on < cutoff) continue;
    const list = byTest.get(v.test_name) ?? [];
    list.push(v);
    byTest.set(v.test_name, list);
  }
  const tests: MemoryLabTest[] = [];
  for (const [test_name, rows] of byTest) {
    const sorted = [...rows].sort((a, b) => (a.measured_on! < b.measured_on! ? -1 : a.measured_on! > b.measured_on! ? 1 : 0));
    const kept = sorted.slice(-MEMORY_LAB_POINTS);
    tests.push({
      test_name,
      unit: [...kept].reverse().find((r) => r.unit)?.unit ?? null,
      points: kept.map((r) => ({ date: r.measured_on!, value: r.value, value_text: r.value_text, flag: labFlag(r.flag), ref_low: r.ref_low, ref_high: r.ref_high })),
    });
  }
  // The tests measured most recently come first; the cap drops the stalest ones.
  tests.sort((a, b) => (a.points[a.points.length - 1].date < b.points[b.points.length - 1].date ? 1 : -1));
  return tests.slice(0, MEMORY_LAB_TESTS);
}

function buildVitals(vitals: MemoryVital[], today: string): MemoryVitalSeries[] {
  const cutoff = monthsAgo(today, MEMORY_VITAL_MONTHS);
  const byType = new Map<string, MemoryVital[]>();
  for (const v of vitals) {
    if (istDateOf(v.measured_at) < cutoff) continue;
    const list = byType.get(v.type) ?? [];
    list.push(v);
    byType.set(v.type, list);
  }
  const series: MemoryVitalSeries[] = [];
  for (const [type, rows] of byType) {
    const sorted = [...rows].sort((a, b) => (a.measured_at < b.measured_at ? -1 : a.measured_at > b.measured_at ? 1 : 0));
    series.push({
      type,
      unit: sorted[sorted.length - 1].unit,
      points: sorted.map((r) => ({ date: istDateOf(r.measured_at), value: r.value, value2: r.value2 })),
    });
  }
  series.sort((a, b) => (a.points[a.points.length - 1].date < b.points[b.points.length - 1].date ? 1 : -1));
  return series;
}

function buildMedicines(items: MemoryMedicineItem[], today: string): MemoryMedicine[] {
  // Current medicines, and ones that ended inside the vitals window, so the bars cover the
  // same stretch as the lines; anything older is history the timeline already tells.
  const cutoff = monthsAgo(today, MEMORY_VITAL_MONTHS);
  return items
    .filter((i) => !i.end_date || i.end_date >= cutoff)
    .map((i) => ({ name: i.medicine_name, strength: i.strength, dose: i.dose, frequency: i.frequency, from: istDateOf(i.created_at), to: i.end_date }))
    .sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : a.name < b.name ? -1 : 1));
}

function buildAdherence(logs: MemoryDoseLog[], today: string): MemoryAdherence {
  const days: MemoryAdherenceDay[] = [];
  const byDate = new Map<string, MemoryAdherenceDay>();
  for (let back = MEMORY_ADHERENCE_DAYS - 1; back >= 0; back--) {
    const day: MemoryAdherenceDay = { date: addDays(today, -back), taken: 0, missed: 0, skipped: 0 };
    days.push(day);
    byDate.set(day.date, day);
  }
  let taken = 0;
  let logged = 0;
  for (const log of logs) {
    const day = byDate.get(istDateOf(log.scheduled_for));
    if (!day) continue;
    if (log.status === "taken" || log.status === "missed" || log.status === "skipped") {
      day[log.status]++;
      logged++;
      if (log.status === "taken") taken++;
    }
  }
  return { days, percent: logged === 0 ? null : Math.round((taken / logged) * 100) };
}

/**
 * Builds the memory of a shared record from its sources. A scope that is off gives a null
 * section, so nothing of it reaches the page; a scope that is on gives its section, capped as
 * above (labs: the last 24 months, at most 24 tests of at most 24 points; vitals: the last
 * 12 months; adherence: the last 30 days, counted by the day in India).
 */
export function buildMemory(sources: MemorySources, scopes: readonly ShareScope[], today: string): ShareMemory {
  const on = new Set(scopes);
  return {
    labs: on.has("labs") ? buildLabs(sources.labs, today) : null,
    vitals: on.has("vitals") ? buildVitals(sources.vitals, today) : null,
    medicines: on.has("medicines") ? buildMedicines(sources.medicines, today) : null,
    adherence: on.has("adherence") ? buildAdherence(sources.adherence, today) : null,
  };
}
