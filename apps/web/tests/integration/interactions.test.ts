import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractionsRes } from "@vyana/shared";
import { USER_ID, VALID_TOKEN, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

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
  it("finds table interactions first, then quoted ones, and lists what it couldn't check", async () => {
    const res = await post();
    expect(res.status).toBe(200);
    const body = InteractionsRes.parse(await res.json());

    expect(body.checked_medicines).toEqual(["Ecosprin 75 mg", "Clopilet 75 mg", "Omez 20 mg"]);
    expect(body.not_checked).toEqual(["Shelcal 500 mg"]);

    const [first, ...rest] = body.interactions;
    expect(first).toMatchObject({ medicine_a: "Clopilet 75 mg", medicine_b: "Omez 20 mg", layer: "table", severity: "major" });
    expect(rest.length).toBe(2); // aspirin+clopidogrel, aspirin+omeprazole (clopidogrel+omeprazole is the table's)
    for (const i of rest) {
      expect(i.layer).toBe("sources");
      expect(i.quote).toMatch(/^Taking (aspirin|clopidogrel|omeprazole) with (aspirin|clopidogrel|omeprazole) may increase the risk of side effects\.$/);
      expect(i.severity).toBe("moderate");
      expect(i.sources[0].url).toMatch(/^https:\/\/medlineplus\.gov\//);
      expect(i.advice).toContain("Don't stop or change");
    }
    expect(JSON.stringify(body)).not.toMatch(/\bsafe\b/i);
    expect(body.sources_checked.map((s) => s.url)).toContain("https://sps.nhs.uk/articles/using-clopidogrel-with-proton-pump-inhibitors-ppis/");
    expect(db.rows.ai_runs[0]).toMatchObject({ feature: "interactions", status: "ok", prompt_version: "interactions@1" });
    expect(db.rows.interaction_checks).toHaveLength(1);
    expect([...db.web_cache.keys()].filter((k) => k.startsWith("interaction_pair:")).sort()).toEqual([
      "interaction_pair:aspirin|clopidogrel",
      "interaction_pair:aspirin|omeprazole",
    ]);
  });

  it("returns the saved result for the same medicines", async () => {
    await post();
    const again = InteractionsRes.parse(await (await post()).json());
    expect(again.cached).toBe(true);
    expect(again.interactions).toHaveLength(3);
    expect(db.rows.ai_runs).toHaveLength(1);
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

  it("is for patients only", async () => {
    db.rows.profiles[0].role = "doctor";
    expect((await post()).status).toBe(403);
    expect((await post({}, "")).status).toBe(401);
    db.rows.profiles[0].role = "patient";
    expect((await post({ prescription_id: "nope" })).status).toBe(400);
  });
});
