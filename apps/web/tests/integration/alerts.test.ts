import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AlertsCheckRes } from "@vyana/shared";
import { OTHER_USER_ID, USER_ID, VALID_TOKEN, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

// Work scheduled with after() is collected here and run by the test.
const scheduled: (() => unknown)[] = [];
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    scheduled.push(fn);
  },
}));

const { POST: check } = await import("@/app/api/alerts/check/route");
const { POST: webhook } = await import("@/app/api/webhooks/tinyfish-monitor/route");
const { alertMatch, namesFor } = await import("@/lib/server/alerts");

const post = (handler: typeof check, url: string, body: unknown, token: string | null = VALID_TOKEN) =>
  handler(
    new Request(url, {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    undefined,
  );

beforeEach(() => {
  vi.stubEnv("TINYFISH_MOCK", "1");
  vi.stubEnv("MONITOR_WEBHOOK_SECRET", "s3cret-value");
  resetDb();
  scheduled.length = 0;
  db.rows.prescription_items = [
    { id: "i1", patient_id: USER_ID, medicine_name: "Dolo", strength: "650 mg", active: true },
    { id: "i2", patient_id: OTHER_USER_ID, medicine_name: "Pan 40", strength: null, active: true },
  ];
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("alert rule (ADR-049)", () => {
  it("needs the medicine (brand or salt) and alert wording, as whole words", () => {
    const dolo = namesFor("Dolo", "650 mg").names;
    expect(dolo).toEqual(["dolo", "paracetamol"]);
    expect(alertMatch("Paracetamol 500 mg batch declared Not of Standard Quality by CDSCO", dolo)).toBe(true);
    expect(alertMatch("Dolo 650 recalled", dolo)).toBe(true);
    expect(alertMatch("Paracetamol: uses and side effects", dolo)).toBe(false); // no alert wording
    expect(alertMatch("NSQ alert for Ibuprofen tablets", dolo)).toBe(false); // another medicine
    expect(alertMatch("Japan recalls a pan masala brand", namesFor("Pan 40", null).names)).toBe(true); // "pan" is a word here
    expect(alertMatch("Japanese drug recall", namesFor("Pan 40", null).names)).toBe(false);
  });
});

describe("POST /api/alerts/check", () => {
  it("saves government alerts that name the patient's medicine, once", async () => {
    const res = await post(check, "http://localhost/api/alerts/check", {});
    expect(res.status).toBe(200);
    const body = AlertsCheckRes.parse(await res.json());
    expect(body.checked_medicines).toEqual(["Dolo 650 mg"]);
    expect(body.alerts.length).toBe(3);
    expect(body.alerts.every((a) => a.url.startsWith("https://cdsco.gov.in/") && a.medicine_name === "Dolo 650 mg")).toBe(true);
    await post(check, "http://localhost/api/alerts/check", {});
    expect(db.rows.drug_alerts).toHaveLength(3); // no duplicates on a second check
  });

  it("is for patients", async () => {
    db.rows.profiles[0].role = "doctor";
    expect((await post(check, "http://localhost/api/alerts/check", {})).status).toBe(403);
    expect((await post(check, "http://localhost/api/alerts/check", {}, null)).status).toBe(401);
  });
});

describe("POST /api/webhooks/tinyfish-monitor", () => {
  const url = (secret: string) => `http://localhost/api/webhooks/tinyfish-monitor?secret=${secret}`;
  const payload = {
    search_monitor_id: "m1",
    results: [
      { position: 1, url: "https://cdsco.gov.in/nsq-sept", title: "NSQ alert: Pantoprazole tablets batch PX12", snippet: "declared not of standard quality" },
      { position: 2, url: "https://news.example.com/pan-recall", title: "Pantoprazole recall", snippet: "recalled" },
      { position: 3, url: "https://cdsco.gov.in/old", title: "Paracetamol NSQ", snippet: "not of standard quality" },
    ],
    new_result_positions: [1, 2],
  };

  it("refuses a wrong secret", async () => {
    expect((await post(webhook, url("nope"), payload, null)).status).toBe(401);
    expect(scheduled).toHaveLength(0);
  });

  it("answers at once, then alerts patients whose medicine a new government result names", async () => {
    const res = await post(webhook, url("s3cret-value"), payload, null);
    expect(res.status).toBe(200);
    expect(db.rows.drug_alerts ?? []).toHaveLength(0); // nothing before after() runs
    for (const fn of scheduled) await fn();
    expect(db.rows.drug_alerts).toEqual([expect.objectContaining({ patient_id: OTHER_USER_ID, medicine_name: "Pan 40", url: "https://cdsco.gov.in/nsq-sept" })]);
    for (const fn of scheduled) await fn(); // a retry adds nothing
    expect(db.rows.drug_alerts).toHaveLength(1);
  });
});
