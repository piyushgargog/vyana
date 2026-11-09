import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { readReportValues } from "@/lib/server/reports";

type Row = Record<string, unknown>;

/**
 * A small in-memory stand-in for the parts of supabase-js the report-values read uses. Like the
 * real hosted PostgREST, an unbounded read answers at most 1000 rows: a read that does not page
 * stops at 1000, so a test with more rows proves the paging.
 */
function memoryDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  const table = (name: string) => (tables[name] ??= []);

  const client = {
    from(name: string) {
      const filters: ((r: Row) => boolean)[] = [];
      let orderCol: string | null = null;
      let slice: [number, number] | null = null;
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), chain),
        order: (c: string) => ((orderCol = c), chain),
        range: (from: number, to: number) => ((slice = [from, to]), chain),
        then: (resolve: (v: { data: Row[] | null; error: null }) => unknown) => {
          let rows = table(name).filter((r) => filters.every((f) => f(r)));
          if (orderCol) rows = [...rows].sort((a, b) => String(a[orderCol as string]).localeCompare(String(b[orderCol as string])));
          if (slice) rows = rows.slice(slice[0], slice[1] + 1);
          rows = rows.slice(0, 1000);
          return resolve({ data: rows.map((r) => ({ ...r })), error: null });
        },
      };
      return chain;
    },
  };
  return { sb: client as unknown as SupabaseClient, table };
}

const at = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString();

function world(valueCount: number) {
  return memoryDb({
    lab_values: Array.from({ length: valueCount }, (_, i) => ({
      id: `v-${String(i).padStart(4, "0")}`,
      report_id: "rep-1",
      patient_id: "p-1",
      test_name: "HbA1c",
      value: 5 + i * 0.001,
      value_text: null,
      unit: "%",
      ref_low: 4,
      ref_high: 5.6,
      flag: "normal",
      created_at: at(i),
    })),
  });
}

describe("readReportValues (issue #743)", () => {
  it("reads every value past the 1000-row page, in the stored order", async () => {
    const db = world(1005);
    const values = await readReportValues(db.sb, "rep-1");
    expect(values).toHaveLength(1005);
    expect(values[0].id).toBe("v-0000");
    expect(values[1004].id).toBe("v-1004");
  });

  it("still reads a short report unchanged", async () => {
    const db = world(3);
    const values = await readReportValues(db.sb, "rep-1");
    expect(values.map((v) => v.id)).toEqual(["v-0000", "v-0001", "v-0002"]);
  });
});
