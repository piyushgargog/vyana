import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OTHER_USER_ID, USER_ID, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const pushed = vi.fn(async () => 0);
vi.mock("@/lib/server/data/alert-push", () => ({ pushQualityAlerts: (...args: unknown[]) => pushed(...(args as [])) }));

const { processMonitorResults } = await import("@/lib/server/alerts");

const results = [
  { url: "https://cdsco.gov.in/nsq-sept", title: "NSQ alert: Pantoprazole tablets batch PX12", snippet: "declared not of standard quality" },
  { url: "https://news.example.com/pan-recall", title: "Pantoprazole recall", snippet: "recalled" },
];

beforeEach(() => {
  vi.stubEnv("TINYFISH_MOCK", "1");
  resetDb();
  pushed.mockClear();
  db.rows.prescription_items = [
    { id: "i1", patient_id: USER_ID, medicine_name: "Dolo", strength: "650 mg", active: true },
    { id: "i2", patient_id: OTHER_USER_ID, medicine_name: "Pan 40", strength: null, active: true },
  ];
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("processMonitorResults and the push", () => {
  it("tells the push helper which patients got new alerts, and how many", async () => {
    await processMonitorResults(results, { tinyfishCalls: 0 });
    expect(pushed).toHaveBeenCalledTimes(1);
    const [, , alerted] = pushed.mock.calls[0] as unknown as [unknown, unknown, { patient_id: string; count: number }[]];
    expect(alerted).toEqual([{ patient_id: OTHER_USER_ID, count: 1 }]);
  });

  it("passes an empty list when a retry finds nothing new, so nobody is told twice", async () => {
    await processMonitorResults(results, { tinyfishCalls: 0 });
    await processMonitorResults(results, { tinyfishCalls: 0 });
    const [, , second] = pushed.mock.calls[1] as unknown as [unknown, unknown, { patient_id: string; count: number }[]];
    expect(second).toEqual([]);
    expect(db.rows.drug_alerts).toHaveLength(1);
  });
});
