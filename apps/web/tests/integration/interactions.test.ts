import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractionsRes } from "@vyana/shared";
import { OTHER_TOKEN, OTHER_USER_ID, USER_ID, VALID_TOKEN, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const { POST } = await import("@/app/api/medicines/interactions/route");

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
  vi.stubEnv("TINYFISH_MOCK", "1");
  vi.stubEnv("LLM_MOCK", "1");
  resetDb();
  db.rows.prescription_items = [
    item("Ecosprin", "75 mg"),
    item("Clopilet", "75 mg"),
    item("Omez", "20 mg"),
    item("Shelcal", "500 mg"),
    item("Telma (Telmisartan)", "40 mg", { active: false }),
  ];
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/medicines/interactions", () => {
  it("finds the reviewed table's interaction and lists every other pair and unknown medicine as not checked", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const body = InteractionsRes.parse(await res.json());

    expect(body.checked_medicines).toEqual(["Ecosprin 75 mg", "Clopilet 75 mg", "Omez 20 mg"]);
    expect(body.interactions).toHaveLength(1);
    expect(body.interactions[0]).toMatchObject({ medicine_a: "Clopilet 75 mg", medicine_b: "Omez 20 mg", layer: "table", severity: "major" });
    expect(body.not_checked).toEqual([
      "Shelcal 500 mg",
      "Ecosprin 75 mg + Clopilet 75 mg (not in the reviewed list yet)",
      "Ecosprin 75 mg + Omez 20 mg (not in the reviewed list yet)",
    ]);
    expect(body.ai.model).toBe("none");
    expect(JSON.stringify(body)).not.toMatch(/safe/i);
    expect(body.sources_checked.map((s) => s.url)).toContain("https://sps.nhs.uk/articles/using-clopidogrel-with-proton-pump-inhibitors-ppis/");
    expect(db.rows.interaction_checks).toHaveLength(1);
    expect(db.rows.ai_runs ?? []).toHaveLength(0); // no model is called any more
  });

  it("returns the saved result for the same medicines", async () => {
    await post();
    const again = InteractionsRes.parse(await (await post()).json());
    expect(again.cached).toBe(true);
    expect(again.interactions).toHaveLength(1);
  });

  it("checks only one prescription when asked", async () => {
    db.rows.prescription_items.push(item("Warf", "5 mg", { prescription_id: "other-rx" }), item("Brufen", "400 mg", { prescription_id: "other-rx" }));
    const body = InteractionsRes.parse(await (await post({ prescription_id: RX_ID })).json());
    expect(body.checked_medicines).not.toContain("Warf 5 mg");
  });

  it("says nothing was checked when fewer than two medicines are known", async () => {
    db.rows.prescription_items = [item("Ecosprin", "75 mg"), item("Shelcal", "500 mg")];
    const body = InteractionsRes.parse(await (await post()).json());
    expect(body).toMatchObject({ checked_medicines: ["Ecosprin 75 mg"], interactions: [], not_checked: ["Shelcal 500 mg"] });
    expect(body.ai.model).toBe("none");
    expect(db.rows.ai_runs ?? []).toHaveLength(0);
  });

  it("is for patients and the doctors who treat them", async () => {
    expect((await post({}, "")).status).toBe(401);
    expect((await post({ prescription_id: "nope" })).status).toBe(400);
    expect((await post({ patient_id: OTHER_USER_ID })).status).toBe(403);
    db.rows.profiles[0].role = "admin";
    expect((await post()).status).toBe(403);
  });

  it("a doctor of the patient checks by prescription or by patient; the result is saved for the patient", async () => {
    db.rows.profiles[1].role = "doctor";
    db.rows.prescriptions = [{ id: RX_ID, patient_id: USER_ID }];
    expect((await post({}, OTHER_TOKEN)).status).toBe(400);
    expect((await post({ patient_id: USER_ID }, OTHER_TOKEN)).status).toBe(403);
    expect((await post({ prescription_id: RX_ID }, OTHER_TOKEN)).status).toBe(403);

    db.doctorOf.add(`${OTHER_USER_ID}:${USER_ID}`);
    const byRx = await post({ prescription_id: RX_ID }, OTHER_TOKEN);
    expect(byRx.status).toBe(200);
    const body = InteractionsRes.parse(await byRx.json());
    expect(body.interactions.length).toBeGreaterThan(0);
    expect((await post({ patient_id: USER_ID }, OTHER_TOKEN)).status).toBe(200);
    expect(db.rows.interaction_checks.every((r) => r.patient_id === USER_ID)).toBe(true);
    expect((await post({ prescription_id: RX_ID, patient_id: OTHER_USER_ID }, OTHER_TOKEN)).status).toBe(403);
  });
});
