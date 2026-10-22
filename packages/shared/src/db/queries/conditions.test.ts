import { describe, expect, it } from "vitest";

import { DbError } from "./helpers";
import { fakeSupabase } from "./fakeSupabase";
import { addCondition, listConditions, updateCondition } from "./conditions";

const ok = (data: unknown) => ({ data, error: null });
const dup = { data: null, error: { message: 'duplicate key value violates unique constraint "idx_conditions_patient_name_key"', code: "23505" } };

describe("listConditions (#333)", () => {
  it("shows each condition once, keeping the oldest row of a name, duplicates or not", async () => {
    const rows = [
      { id: "new-dup", name: "Type 2 Diabetes", created_at: "2026-10-22T00:00:00Z" },
      { id: "other", name: "Asthma", created_at: "2026-10-10T00:00:00Z" },
      { id: "old-dup", name: " type 2 diabetes ", created_at: "2026-10-01T00:00:00Z" },
    ];
    const f = fakeSupabase({ responses: { conditions: [ok(rows)] } });
    const out = await listConditions(f.sb);
    expect(out.map((r) => r.id)).toEqual(["other", "old-dup"]);
  });

  it("leaves a list without duplicates untouched", async () => {
    const rows = [
      { id: "a", name: "Asthma", created_at: "2026-10-10T00:00:00Z" },
      { id: "b", name: "Type 2 Diabetes", created_at: "2026-10-01T00:00:00Z" },
    ];
    const f = fakeSupabase({ responses: { conditions: [ok(rows)] } });
    expect((await listConditions(f.sb)).map((r) => r.id)).toEqual(["a", "b"]);
  });
});

describe("addCondition / updateCondition (#333)", () => {
  it("a duplicate insert answers with a plain error, not the database's words", async () => {
    const f = fakeSupabase({ responses: { conditions: [dup] } });
    const err = await addCondition(f.sb, { name: "type 2 diabetes" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("You already have this condition on your list.");
    expect((err as DbError).code).toBe("23505");
  });

  it("renaming a condition into an existing one answers the same way", async () => {
    const f = fakeSupabase({ responses: { conditions: [dup] } });
    const err = await updateCondition(f.sb, "c1", { name: "Asthma" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(DbError);
    expect((err as DbError).message).toBe("You already have this condition on your list.");
  });

  it("other errors keep the database's own message", async () => {
    const f = fakeSupabase({ responses: { conditions: [{ data: null, error: { message: "rls says no", code: "42501" } }] } });
    const err = await addCondition(f.sb, { name: "Asthma" }).catch((e: unknown) => e);
    expect((err as DbError).message).toBe("rls says no");
  });
});
