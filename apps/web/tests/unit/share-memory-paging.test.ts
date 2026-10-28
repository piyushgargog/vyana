import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadSharedRecord } from "@/lib/server/data/share";

type Row = Record<string, unknown>;

/**
 * A small in-memory stand-in for the parts of supabase-js the share read uses (the
 * care-agent-loop fake's shape, plus `gte`, `maybeSingle` and multi-key order). PostgREST
 * answers at most 1000 rows to an unbounded read, so the fake caps a read without `range`
 * at 1000, exactly like the live one: a fix that only works because the fake returns
 * everything cannot pass here.
 */
function memoryDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  const table = (name: string) => (tables[name] ??= []);
  const cmp = (a: unknown, b: unknown) => (a === b ? 0 : String(a) < String(b) ? -1 : 1);

  const client = {
    from(name: string) {
      const filters: ((r: Row) => boolean)[] = [];
      const orders: { col: string; asc: boolean }[] = [];
      let slice: [number, number] | null = null;
      let limitN: number | null = null;
      const run = () => {
        let rows = table(name).filter((r) => filters.every((f) => f(r)));
        for (const o of [...orders].reverse()) {
          rows = [...rows].sort((a, b) => (o.asc ? cmp(a[o.col], b[o.col]) : cmp(b[o.col], a[o.col])));
        }
        if (slice) rows = rows.slice(slice[0], slice[1] + 1);
        else if (limitN !== null) rows = rows.slice(0, limitN);
        else rows = rows.slice(0, 1000);
        return rows.map((r) => ({ ...r }));
      };
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), chain),
        gte: (c: string, v: unknown) => (
          filters.push((r) => {
            const a = Date.parse(String(r[c]));
            const b = Date.parse(String(v));
            return Number.isNaN(a) || Number.isNaN(b) ? String(r[c]) >= String(v) : a >= b;
          }),
          chain
        ),
        order: (c: string, opts?: { ascending?: boolean }) => (orders.push({ col: c, asc: opts?.ascending ?? true }), chain),
        range: (from: number, to: number) => ((slice = [from, to]), chain),
        limit: (n: number) => ((limitN = n), chain),
        maybeSingle: () => Promise.resolve({ data: run()[0] ?? null, error: null }),
        then: (resolve: (v: { data: Row[]; error: null }) => unknown) => resolve({ data: run(), error: null }),
      };
      return chain;
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
  return { sb: client as unknown as SupabaseClient };
}

const TOKEN = "a".repeat(48);
const now = new Date("2026-10-28T05:00:00.000Z"); // 2026-10-28 in India

const day = (i: number) => String(1 + (i % 28)).padStart(2, "0");

function world() {
  return memoryDb({
    share_links: [
      { token: TOKEN, patient_id: "p-1", kind: "timeline", expires_at: "2027-01-01T00:00:00.000Z", revoked: false, scopes: ["labs", "vitals", "adherence"] },
    ],
    profiles: [{ id: "p-1", full_name: "Test Patient", dob: null, blood_group: null, allergies: [] }],
    conditions: [],
    prescription_items: [],
    prescriptions: [],
    lab_reports: [],
    appointments: [],
    // 1005 glucose rows in October 2026 fill any single newest-first read on their own,
    // while one HbA1c point from June 2025 sits inside the 24-month window behind them.
    lab_values: [
      ...Array.from({ length: 1005 }, (_, i) => ({
        id: `g-${String(i).padStart(4, "0")}`,
        patient_id: "p-1",
        test_name: "Glucose",
        value: 100,
        unit: "mg/dL",
        flag: "normal",
        ref_low: 70,
        ref_high: 120,
        measured_on: `2026-10-${day(i)}`,
      })),
      { id: "h-1", patient_id: "p-1", test_name: "HbA1c", value: 6.5, unit: "%", flag: "high", ref_low: 4, ref_high: 5.7, measured_on: "2025-06-15" },
    ],
    // 1005 blood-pressure rows in October 2026, one SpO2 reading from March 2026 behind them.
    vitals: [
      ...Array.from({ length: 1005 }, (_, i) => ({
        id: `bp-${String(i).padStart(4, "0")}`,
        patient_id: "p-1",
        type: "blood_pressure",
        value: 120,
        value2: 80,
        unit: "mmHg",
        measured_at: `2026-10-${day(i)}T08:00:00.000Z`,
      })),
      { id: "s-1", patient_id: "p-1", type: "spo2", value: 98, value2: null, unit: "%", measured_at: "2026-03-10T08:00:00.000Z" },
    ],
    // 1005 taken logs fill a single newest-first read; 100 missed logs from the oldest
    // days of the 30-day window sit behind them and must still count.
    dose_logs: [
      ...Array.from({ length: 1005 }, (_, i) => ({
        id: `t-${String(i).padStart(4, "0")}`,
        patient_id: "p-1",
        scheduled_for: `2026-10-${day(i)}T08:00:00.000Z`,
        status: "taken",
      })),
      ...Array.from({ length: 100 }, (_, i) => ({
        id: `m-${String(i).padStart(4, "0")}`,
        patient_id: "p-1",
        scheduled_for: `2026-09-${i < 50 ? "29" : "30"}T08:00:00.000Z`,
        status: "missed",
      })),
    ],
  });
}

describe("share memory paging past the row cap", () => {
  it("discovers a lab test whose latest point sits past the 1000th newest row", async () => {
    const { sb } = world();
    const res = await loadSharedRecord(sb, TOKEN, now);
    expect((res.memory?.labs ?? []).map((t) => t.test_name)).toContain("HbA1c");
  });

  it("keeps a vital type whose latest reading sits past the 1000th newest row", async () => {
    const { sb } = world();
    const res = await loadSharedRecord(sb, TOKEN, now);
    expect((res.memory?.vitals ?? []).map((v) => v.type)).toContain("spo2");
  });

  it("counts dose logs past the 1000th newest row in the taken percentage", async () => {
    const { sb } = world();
    const res = await loadSharedRecord(sb, TOKEN, now);
    expect(res.memory?.adherence?.percent_taken).toBe(91);
  });
});
