import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TriageRes } from "@vyana/shared";
import { VALID_TOKEN, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

// Records what reaches runAi (and so the model), then runs the real one.
const aiCalls: { prompt?: string }[] = [];
vi.mock("@/lib/server/ai", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/server/ai")>();
  return {
    ...real,
    runAi: (input: Parameters<typeof real.runAi>[0]) => {
      aiCalls.push(input as { prompt?: string });
      return real.runAi(input);
    },
  };
});

const { POST } = await import("@/app/api/triage/route");
const { ADVICE, DISCLAIMER, TRIAGE_WATCH_FOR } = await import("@/lib/server/triage");

const post = (body: unknown, token = VALID_TOKEN) =>
  POST(
    new Request("http://localhost/api/triage", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    undefined,
  );

const departments = (...names: string[]) => {
  db.rows.departments = names.map((name, i) => ({ id: `d${i}`, hospital_id: "h1", name }));
};

beforeEach(() => {
  vi.stubEnv("TINYFISH_MOCK", "1");
  vi.stubEnv("LLM_MOCK", "1");
  resetDb();
  aiCalls.length = 0;
  departments("Cardiology", "Dermatology", "General Medicine", "Dermatology");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/triage", () => {
  it("sends emergency warning signs straight to 108 / SOS, with no AI", async () => {
    const res = await post({ symptoms: "chest pain and sweating since morning" });
    expect(res.status).toBe(200);
    const body = TriageRes.parse(await res.json());
    expect(body).toMatchObject({ urgency: "emergency", departments: ["Emergency"], advice: "Call 108 now or press SOS.", red_flags: ["Chest pain or pressure"] });
    expect(body.ai.model).toBe("rules");
    expect(aiCalls).toHaveLength(0);
    expect(db.rows.ai_runs ?? []).toHaveLength(0);
  });

  it("catches Hinglish warning signs and answers in the user's language", async () => {
    db.rows.profiles[0].preferred_language = "hinglish";
    const body = TriageRes.parse(await (await post({ symptoms: "seene mein dard ho raha hai" })).json());
    expect(body.urgency).toBe("emergency");
    expect(body.advice).toBe(ADVICE.hinglish.emergency(""));
    expect(body.disclaimer).toBe(DISCLAIMER.hinglish);
  });

  it("routes a non-urgent symptom to a seeded department, dropping names that aren't on the list", async () => {
    const body = TriageRes.parse(await (await post({ symptoms: "itchy skin rash on my arm", duration: "3 days", age: 30, sex: "female" })).json());
    expect(body.urgency).toBe("routine");
    expect(body.departments).toEqual(["Dermatology"]); // the mock's "Astrology" is dropped
    expect(body.advice).toBe(ADVICE.en.routine("Dermatology"));
    expect(body.red_flags).toHaveLength(TRIAGE_WATCH_FOR.length);
    expect(body.red_flags).toContain("Trouble breathing");
    expect(db.rows.ai_runs[0]).toMatchObject({ feature: "triage", status: "needs_review", prompt_version: "triage@1" });
    expect(aiCalls[0].prompt).toContain("Allowed departments: Cardiology, Dermatology, General Medicine");
  });

  it("falls back to General Medicine when no suggested department exists", async () => {
    departments("General Medicine");
    const body = TriageRes.parse(await (await post({ symptoms: "itchy skin rash" })).json());
    expect(body.departments).toEqual(["General Medicine"]);
  });

  it("says 'see a doctor soon' when the AI can't answer", async () => {
    vi.stubEnv("LLM_MOCK", "0"); // no provider configured → the model call fails
    const res = await post({ symptoms: "itchy skin rash" });
    expect(res.status).toBe(200);
    const body = TriageRes.parse(await res.json());
    expect(body).toMatchObject({ urgency: "soon", departments: ["General Medicine"] });
    expect(body.ai.model).toBe("fallback");
  });

  it("removes personal details before the symptoms reach the model", async () => {
    await post({ symptoms: "My name is Rahul Sharma, call 9876543210, I have an itchy rash" });
    expect(aiCalls[0].prompt).not.toContain("Rahul");
    expect(aiCalls[0].prompt).not.toContain("9876543210");
    expect(aiCalls[0].prompt).toContain("itchy rash");
  });

  it("rejects bad requests", async () => {
    expect((await post({ symptoms: "rash" }, "")).status).toBe(401);
    expect((await post({ symptoms: "ab" })).status).toBe(400);
    expect((await post({ symptoms: "rash", age: 200 })).status).toBe(400);
  });
});
