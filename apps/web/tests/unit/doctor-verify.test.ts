import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthedUser } from "@/lib/server/auth";

// 1500 verified doctors, in id order, with the duplicate sitting past the
// 1000 row PostgREST cap (index 1200). The admin check must still see it.
const verified: { id: string; reg_no: string | null; state_council: string | null }[] = [];
const updates: unknown[] = [];

vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => ({
    from: () => {
      const q = { select: "", eqCol: "", eqVal: "" as unknown };
      const chain = {
        select: (cols: string) => ((q.select = cols), chain),
        eq: (col: string, val: unknown) => ((q.eqCol = col), (q.eqVal = val), chain),
        order: (_col: string) => chain,
        range: (from: number, to: number) => Promise.resolve({ data: verified.slice(from, to + 1), error: null }),
        maybeSingle: async () => {
          if (q.select === "id") return { data: { id: q.eqVal }, error: null };
          return { data: null, error: null };
        },
        update: (patch: unknown) => {
          updates.push(patch);
          return { eq: async () => ({ error: null }) };
        },
      };
      return chain;
    },
  }),
}));

const { adminCheckDoctor } = await import("@/lib/server/doctor-verify");

const admin = { user: { id: "admin-1" } } as unknown as AuthedUser;
const targetId = "aaaaaaaa-1111-4111-8111-111111111111";

beforeEach(() => {
  verified.length = 0;
  updates.length = 0;
  for (let i = 0; i < 1500; i += 1) {
    verified.push({
      id: `doc-${String(i).padStart(4, "0")}`,
      reg_no: i === 1200 ? "MCI 12345" : `REG-${i}`,
      state_council: i === 1200 ? "Delhi Medical Council" : "Karnataka Medical Council",
    });
  }
});

describe("adminCheckDoctor duplicate check", () => {
  it("refuses a registration already verified past the first 1000 rows, spelled differently", async () => {
    await expect(
      adminCheckDoctor(admin, {
        doctor_id: targetId,
        decision: "approve",
        reg_no: "mci/12345",
        state_council: "Medical Council of Delhi",
        year: 2019,
        note: "",
      }),
    ).rejects.toThrow("This registration is already linked to another account.");
    expect(updates).toEqual([]);
  });

  it("approves a registration no verified doctor holds", async () => {
    const res = await adminCheckDoctor(admin, {
      doctor_id: targetId,
      decision: "approve",
      reg_no: "MCI 99999",
      state_council: "Delhi",
      year: 2019,
      note: "",
    });
    expect(res.status).toBe("verified");
    expect(updates).toHaveLength(1);
  });
});
