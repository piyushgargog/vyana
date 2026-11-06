import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

// A saved interaction answer keyed by the old medicines-only hash must not be
// served once the table version is part of the key: a table update can add an
// interaction the saved answer omits, and the saved row must not hide it for
// up to a week. Warf (warfarin) + Ecosprin (aspirin) is a hit in the current
// table, yet the saved row below says none.
const store = vi.hoisted(() => ({ keyToMatch: "" }));

const saved = vi.hoisted(() => ({
  id: "saved-1",
  result_json: {
    checked_medicines: ["Warf 5", "Ecosprin 75"],
    interactions: [],
    sources_checked: [],
    not_checked: [],
    cached: false,
    ai: { model: "none", prompt_version: "table@1", generated_at: new Date().toISOString() },
  },
  created_at: new Date().toISOString(),
}));

const chainable = (result: unknown) => {
  const b: Record<string, unknown> = {};
  let key = "";
  b.select = () => b;
  b.eq = (col: string, value: unknown) => {
    if (col === "medicines_key" && typeof value === "string") key = value;
    return b;
  };
  b.maybeSingle = async () => ({ data: key === store.keyToMatch ? result : null, error: null });
  b.insert = () => b;
  b.update = () => b;
  b.then = (resolve: (v: unknown) => unknown) => Promise.resolve({ data: result, error: null }).then(resolve);
  return b;
};

vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => (table === "interaction_checks" ? chainable(saved) : chainable([])),
  }),
}));

import { checkInteractions, INTERACTIONS_VERSION } from "@/lib/server/interactions";
import { lookupInteractions } from "@/lib/server/safety/interactions-table";

const userSb = {
  from: (table: string) =>
    table === "prescription_items"
      ? chainable([
          { medicine_name: "Warf", strength: "5" },
          { medicine_name: "Ecosprin", strength: "75" },
        ])
      : chainable([]),
};

const authed = {
  sb: userSb,
  user: { id: "patient-1", email: null },
  profile: { id: "patient-1", role: "patient", full_name: null },
} as never;

// The two medicines, sorted the way the key builder sorts them.
const medicineParts = ["Ecosprin 75|aspirin", "Warf 5|warfarin"];
const oldKey = createHash("sha256").update(JSON.stringify(medicineParts)).digest("hex");
const newKey = createHash("sha256")
  .update(JSON.stringify([INTERACTIONS_VERSION, medicineParts]))
  .digest("hex");

describe("interactions cache key carries the table version", () => {
  it("ignores a saved row keyed without the version and recomputes from the table", async () => {
    store.keyToMatch = oldKey;
    const res = await checkInteractions(authed, {});
    expect(res.cached).toBe(false);
    expect(res.interactions.map((i) => `${i.medicine_a} + ${i.medicine_b}`)).toContain("Warf 5 + Ecosprin 75");
  });

  it("still serves a saved row keyed with the current version", async () => {
    store.keyToMatch = newKey;
    const res = await checkInteractions(authed, {});
    expect(res.cached).toBe(true);
    expect(res.interactions).toEqual([]);
  });

  it("control: the live table does find warfarin+aspirin for the same two salts", () => {
    const hits = lookupInteractions(["warfarin", "aspirin"]);
    expect(hits).toHaveLength(1);
    expect(hits[0].entry.id).toBe("warfarin+aspirin");
  });
});
