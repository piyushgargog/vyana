import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorBody, GenerateCarePlanRes } from "@vyana/shared";
import { OTHER_USER_ID, USER_ID, VALID_TOKEN, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const { POST } = await import("@/app/api/care-plan/route");

const CONDITION_ID = "6b1f0c3e-2d4a-4e8b-9c7d-1a2b3c4d5e6f";

const post = (body: unknown, token = VALID_TOKEN) =>
  POST(
    new Request("http://localhost/api/care-plan", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    undefined,
  );

beforeEach(() => {
  vi.stubEnv("TINYFISH_MOCK", "1");
  vi.stubEnv("LLM_MOCK", "1");
  resetDb();
  db.rows.conditions = [{ id: CONDITION_ID, patient_id: USER_ID, name: "Type 2 Diabetes", source: "patient" }];
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/care-plan", () => {
  it("builds a patient-generated plan from quoted bullets and the curated red flags", async () => {
    const res = await post({ condition_id: CONDITION_ID });
    expect(res.status).toBe(200);
    const body = GenerateCarePlanRes.parse(await res.json());

    expect(body.status).toBe("patient_generated");
    const { plan } = body;
    expect(plan.condition).toBe("Type 2 Diabetes");
    expect(plan.do).toEqual(["Walk briskly for 30 minutes a day."]); // the invented "3 litres of water" bullet is dropped
    expect(plan.dont).toEqual(["Don't smoke, and limit alcohol."]);
    expect(plan.diet.sample_day).toEqual([
      { meal: "breakfast", items: ["oats"] }, // "milk" isn't a cited food
      { meal: "lunch", items: ["brown rice", "dal", "vegetables"] },
    ]);
    expect(plan.follow_up_tests).toEqual([{ test: "HbA1c", every_days: 90 }]);
    expect(plan.red_flags[0]).toBe("Feeling very unwell");
    expect(plan.red_flags).toContain("Chest pain or pressure");
    expect(plan.sources.map((s) => s.url)).toEqual(
      expect.arrayContaining(["https://medlineplus.gov/type-2-diabetes-1.html", "https://medlineplus.gov/ency/article/000313.htm"]),
    );

    const saved = db.rows.care_plans[0];
    expect(saved).toMatchObject({ id: body.care_plan_id, patient_id: USER_ID, condition_id: CONDITION_ID, status: "patient_generated", language: "en" });
    expect(db.rows.ai_runs[0]).toMatchObject({ feature: "care_plan", status: "needs_review", prompt_version: "care-plan@1" });
  });

  it("writes a draft when the patient's doctor asks, in the patient's language", async () => {
    db.rows.profiles[0].preferred_language = "hinglish";
    db.rows.profiles[1].role = "doctor";
    db.rows.conditions[0].source = "doctor";
    const res = await post({ condition_id: CONDITION_ID }, "other-user-token");
    expect(res.status).toBe(200);
    const body = GenerateCarePlanRes.parse(await res.json());
    expect(body.status).toBe("draft");
    expect(body.plan.language).toBe("hinglish");
    expect(db.rows.care_plans[0]).toMatchObject({ patient_id: USER_ID, status: "draft", language: "hinglish" });
  });

  it("doesn't let a patient generate a plan for a doctor's diagnosis", async () => {
    db.rows.conditions[0].source = "doctor";
    const res = await post({ condition_id: CONDITION_ID });
    expect(res.status).toBe(403);
    expect(ApiErrorBody.parse(await res.json()).error.message).toContain("Your doctor prepares");
    expect(db.rows.care_plans ?? []).toHaveLength(0);
  });

  it("hides other patients' conditions", async () => {
    db.rows.conditions[0].patient_id = OTHER_USER_ID;
    expect((await post({ condition_id: CONDITION_ID })).status).toBe(404);
    expect((await post({ condition_id: "0c1d2e3f-4a5b-4c6d-8e7f-8a9b0c1d2e3f" })).status).toBe(404);
  });

  it("is for patients and doctors only, and needs a valid body", async () => {
    db.rows.profiles[0].role = "admin";
    expect((await post({ condition_id: CONDITION_ID })).status).toBe(403);
    db.rows.profiles[0].role = "patient";
    expect((await post({ condition_id: "not-a-uuid" })).status).toBe(400);
    expect((await post({ condition_id: CONDITION_ID }, "")).status).toBe(401);
  });

  it("caches the guideline pages per condition", async () => {
    await post({ condition_id: CONDITION_ID });
    await post({ condition_id: CONDITION_ID });
    expect([...db.web_cache.keys()].filter((k) => k.startsWith("careplan_pages:"))).toEqual(["careplan_pages:v3:type 2 diabetes"]);
    expect(db.rows.care_plans).toHaveLength(2);
  });
});
