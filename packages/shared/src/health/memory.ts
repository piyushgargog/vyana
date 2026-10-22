// packages/shared/src/health/memory.ts
// The Health Memory Graph of a shared record (issue #237): the long view behind a share link —
// lab trends, vital lines, medicines over time and the last 30 days of doses. Pure functions:
// the server fetches the rows (capped, only for the scopes that are on) and passes `today`
// (the day in India) in, so every boundary below can be tested without a clock. The shape built
// here is the contracts' `ShareMemory` (#246): a scope that is off leaves its key out entirely.
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
  unit: string | null;
  flag: string;
  ref_low: number | null;
  ref_high: number | null;
  measured_on: string | null;
}

/** One reading as the server read it (a row of `vitals`). */
export interface MemoryVital {
  type: string;
  value: number | null;
  value2: number | null;
  unit: string | null;
  measured_at: string;
  /** Where the reading came from (`manual`, `health_connect`, `healthkit`, `ble`); rows read before the column existed carry none and read as manual. */
  source?: string | null;
}

/** One medicine as the server read it (a row of `prescription_items`). */
export interface MemoryMedicineItem {
  medicine_name: string;
  strength: string | null;
  dose: string | null;
  frequency: string;
  /** The day the medicine was started, when the prescription says; `created_at` is only the fallback. */
  start_date: string | null;
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

type LabTest = NonNullable<ShareMemory["labs"]>[number];
type VitalSeries = NonNullable<ShareMemory["vitals"]>[number];
type Medicine = NonNullable<ShareMemory["medicines"]>[number];
type Adherence = NonNullable<ShareMemory["adherence"]>;

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

/** A flag from the database as the contract holds it (the column's check already holds it to these four). */
function labFlag(flag: string): MemoryLabFlag {
  return flag === "low" || flag === "normal" || flag === "high" ? flag : "unknown";
}

function buildLabs(values: MemoryLabValue[], today: string): LabTest[] {
  const cutoff = monthsAgo(today, MEMORY_LAB_MONTHS);
  const byTest = new Map<string, MemoryLabValue[]>();
  for (const v of values) {
    // A point with no number cannot be drawn on the graph, so it is left out (contract #246).
    if (!v.measured_on || v.measured_on < cutoff || v.value === null) continue;
    const list = byTest.get(v.test_name) ?? [];
    list.push(v);
    byTest.set(v.test_name, list);
  }
  const tests: LabTest[] = [];
  for (const [test_name, rows] of byTest) {
    const sorted = [...rows].sort((a, b) => (a.measured_on! < b.measured_on! ? -1 : a.measured_on! > b.measured_on! ? 1 : 0));
    const kept = sorted.slice(-MEMORY_LAB_POINTS);
    // The reference range belongs to the test, not to a point: the latest reading that
    // carries one speaks for the test.
    const newestFirst = [...sorted].reverse();
    tests.push({
      test_name,
      unit: newestFirst.find((r) => r.unit)?.unit ?? null,
      ref_low: newestFirst.find((r) => r.ref_low !== null)?.ref_low ?? null,
      ref_high: newestFirst.find((r) => r.ref_high !== null)?.ref_high ?? null,
      points: kept.map((r) => ({ date: r.measured_on!, value: r.value!, flag: labFlag(r.flag) })),
    });
  }
  // The tests measured most recently come first; the cap drops the stalest ones.
  tests.sort((a, b) => (a.points[a.points.length - 1].date < b.points[b.points.length - 1].date ? 1 : -1));
  return tests.slice(0, MEMORY_LAB_TESTS);
}

function buildVitals(vitals: MemoryVital[], today: string): VitalSeries[] {
  const cutoff = monthsAgo(today, MEMORY_VITAL_MONTHS);
  const byType = new Map<string, MemoryVital[]>();
  for (const v of vitals) {
    if (v.value === null || istDateOf(v.measured_at) < cutoff) continue;
    const list = byType.get(v.type) ?? [];
    list.push(v);
    byType.set(v.type, list);
  }
  const series: VitalSeries[] = [];
  for (const [type, rows] of byType) {
    const sorted = [...rows].sort((a, b) => (a.measured_at < b.measured_at ? -1 : a.measured_at > b.measured_at ? 1 : 0));
    series.push({
      type,
      unit: [...sorted].reverse().find((r) => r.unit)?.unit ?? null,
      // A reading the sync engine stored is marked as from a device (issue #328); a manual
      // reading carries no mark, so old payloads stay exactly as they were.
      points: sorted.map((r) => ({
        at: r.measured_at,
        value: r.value!,
        value2: r.value2,
        ...(r.source && r.source !== "manual" ? { from_device: true } : {}),
      })),
    });
  }
  series.sort((a, b) => (a.points[a.points.length - 1].at < b.points[b.points.length - 1].at ? 1 : -1));
  return series;
}

function buildMedicines(items: MemoryMedicineItem[], today: string): Medicine[] {
  // Current medicines, and ones that ended inside the vitals window, so the bars cover the
  // same stretch as the lines; anything older is history the timeline already tells.
  const cutoff = monthsAgo(today, MEMORY_VITAL_MONTHS);
  return items
    .filter((i) => !i.end_date || i.end_date >= cutoff)
    .map((i) => ({
      name: i.medicine_name,
      strength: i.strength,
      dose: i.dose,
      frequency: i.frequency,
      // The day the medicine started is what the prescription says (start_date); the day the
      // row was typed in is only the fallback, or a medicine taken for years would look new.
      start: i.start_date ?? istDateOf(i.created_at),
      end: i.end_date,
    }))
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.name < b.name ? -1 : 1));
}

function buildAdherence(logs: MemoryDoseLog[], today: string): Adherence {
  const days: Adherence["days"] = [];
  const byDate = new Map<string, Adherence["days"][number]>();
  for (let back = MEMORY_ADHERENCE_DAYS - 1; back >= 0; back--) {
    const day = { date: addDays(today, -back), taken: 0, missed: 0, skipped: 0 };
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
  return { days, percent_taken: logged === 0 ? null : Math.round((taken / logged) * 100) };
}

/**
 * Builds the memory of a shared record from its sources. Only the sections whose scope is on
 * are present in the result (the contract's shape), capped as above (labs: the last 24 months,
 * at most 24 tests of at most 24 points; vitals: the last 12 months; adherence: the last
 * 30 days, counted by the day in India).
 */
export function buildMemory(sources: MemorySources, scopes: readonly ShareScope[], today: string): ShareMemory {
  const on = new Set(scopes);
  const memory: ShareMemory = {};
  if (on.has("labs")) memory.labs = buildLabs(sources.labs, today);
  if (on.has("vitals")) memory.vitals = buildVitals(sources.vitals, today);
  if (on.has("medicines")) memory.medicines = buildMedicines(sources.medicines, today);
  if (on.has("adherence")) memory.adherence = buildAdherence(sources.adherence, today);
  return memory;
}
