import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadSharedRecord } from "@/lib/server/data/share";

type Row = Record<string, unknown>;

/**
 * A small in-memory stand-in for the parts of supabase-js the share read uses. Like the real
 * hosted PostgREST, an unbounded read answers at most 1000 rows: a read that does not page
 * stops at 1000, so a test with more rows proves the paging.
 */
function memoryDb(seed: Record<string, Row[]>) {
  const tables: Record<string, Row[]> = JSON.parse(JSON.stringify(seed));
  const table = (name: string) => (tables[name] ??= []);

  const client = {
    from(name: string) {
      const filters: ((r: Row) => boolean)[] = [];
      let orderCol: string | null = null;
      let ascending = true;
      let slice: [number, number] | null = null;
      const chain = {
        select: () => chain,
        eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), chain),
        order: (c: string, opts?: { ascending?: boolean }) => ((orderCol = c), (ascending = opts?.ascending ?? true), chain),
        range: (from: number, to: number) => ((slice = [from, to]), chain),
        maybeSingle: () => {
          const rows = table(name).filter((r) => filters.every((f) => f(r)));
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then: (resolve: (v: { data: Row[] | null; error: null }) => unknown) => {
          let rows = table(name).filter((r) => filters.every((f) => f(r)));
          if (orderCol) {
            rows = [...rows].sort((a, b) => {
              const cmp = String(a[orderCol as string]).localeCompare(String(b[orderCol as string]));
              return ascending ? cmp : -cmp;
            });
          }
          if (slice) rows = rows.slice(slice[0], slice[1] + 1);
          rows = rows.slice(0, 1000);
          return resolve({ data: rows.map((r) => ({ ...r })), error: null });
        },
      };
      return chain;
    },
    rpc: () => Promise.resolve({ data: null, error: null }),
  };
  return { sb: client as unknown as SupabaseClient, table };
}

const TOKEN = "a".repeat(48);
const at = (i: number) => new Date(Date.UTC(2026, 0, 1) + i * 1000).toISOString();

function world(conditionCount: number) {
  return memoryDb({
    share_links: [
      { token: TOKEN, patient_id: "p-1", kind: "medical_id", expires_at: "2099-01-01T00:00:00.000Z", revoked: false, scopes: null },
    ],
    profiles: [{ id: "p-1", full_name: "Test Patient", dob: "1990-05-01", blood_group: "O+", allergies: ["Peanuts"] }],
    conditions: Array.from({ length: conditionCount }, (_, i) => ({
      patient_id: "p-1",
      name: `Condition ${i}`,
      active: true,
      created_at: at(i),
    })),
    prescription_items: [0, 1, 2].map((i) => ({
      patient_id: "p-1",
      medicine_name: `Med ${i}`,
      strength: "500 mg",
      dose: "1",
      frequency: "OD",
      start_date: "2026-01-01",
      end_date: null,
      created_at: at(i),
      active: true,
    })),
    emergency_contacts: [0, 1].map((i) => ({ patient_id: "p-1", name: `Contact ${i}`, phone: `900000000${i}`, created_at: at(i) })),
  });
}

describe("loadSharedRecord profile lists (issue #743)", () => {
  it("reads every condition past the 1000-row page, so a long history is not cut off", async () => {
    const db = world(1005);
    const res = await loadSharedRecord(db.sb, TOKEN);
    expect(res.profile.conditions).toHaveLength(1005);
    expect(res.profile.conditions[0]).toBe("Condition 0");
    expect(res.profile.conditions[1004]).toBe("Condition 1004");
    expect(res.profile.active_medicines).toHaveLength(3);
    expect(res.profile.emergency_contacts).toHaveLength(2);
  });

  it("still reads a short list unchanged", async () => {
    const db = world(2);
    const res = await loadSharedRecord(db.sb, TOKEN);
    expect(res.profile.conditions).toEqual(["Condition 0", "Condition 1"]);
    expect(res.profile.full_name).toBe("Test Patient");
  });
});
