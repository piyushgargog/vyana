import { beforeEach, describe, expect, it, vi } from "vitest";
import { InteractionsRes } from "@vyana/shared";
import { USER_ID, VALID_TOKEN, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);
vi.mock("@/lib/server/safety/interactions-table", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server/safety/interactions-table")>();
  return { ...real, lookupInteractions: vi.fn((medicines: string[]) => real.lookupInteractions(medicines)) };
});

const { POST } = await import("@/app/api/medicines/interactions/route");
const { lookupInteractions } = await import("@/lib/server/safety/interactions-table");

const RX_ID = "5a6b7c8d-9e0f-4a1b-8c2d-3e4f5a6b7c8d";

const post = (body: unknown = {}, token = VALID_TOKEN) =>
  POST(
    new Request("http://localhost/api/medicines/interactions", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    undefined,
  );

const item = (medicine_name: string, strength: string | null, extra: Record<string, unknown> = {}) => ({
  id: `i-${medicine_name}`,
  patient_id: USER_ID,
  prescription_id: RX_ID,
  medicine_name,
  strength,
  active: true,
  ...extra,
});

beforeEach(() => {
  vi.stubEnv("WEB_MOCK", "1");
  vi.stubEnv("LLM_MOCK", "1");
  resetDb();
  db.rows.prescription_items = [item("Ecosprin", "75 mg"), item("Clopilet", "75 mg"), item("Omez", "20 mg"), item("Shelcal", "500 mg")];
  vi.mocked(lookupInteractions).mockClear();
});

describe("POST /api/medicines/interactions table lookup", () => {
  it("reads the table once and still lists every uncovered pair as not checked (#689)", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const body = InteractionsRes.parse(await res.json());
    expect(body.interactions).toHaveLength(1);
    expect(body.not_checked).toEqual([
      "Shelcal 500 mg",
      "Ecosprin 75 mg + Clopilet 75 mg (not in the reviewed list yet)",
      "Ecosprin 75 mg + Omez 20 mg (not in the reviewed list yet)",
    ]);
    expect(vi.mocked(lookupInteractions).mock.calls).toHaveLength(1);
  });
});
