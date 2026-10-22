import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EmergencyNearbyRes, EmergencySosRes, HospitalInfoRes } from "@vyana/shared";
import { USER_ID, VALID_TOKEN, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

// Work scheduled with after() is collected here instead of running.
const scheduled: (() => unknown)[] = [];
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => unknown) => {
    scheduled.push(fn);
  },
}));

const { POST: nearby } = await import("@/app/api/emergency/nearby/route");
const { POST: sos } = await import("@/app/api/emergency/sos/route");
const { POST: info } = await import("@/app/api/hospitals/info/route");
const { simulateAmbulance } = await import("@/lib/server/emergency");

const post = (handler: (req: Request, p: undefined) => Promise<Response>, body: unknown, token: string | null = VALID_TOKEN) =>
  handler(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    undefined,
  );

beforeEach(() => {
  vi.stubEnv("WEB_MOCK", "1");
  vi.stubEnv("LLM_MOCK", "1");
  resetDb();
  scheduled.length = 0;
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/emergency/nearby", () => {
  it("returns hospitals that are on the fetched page, with a server-built maps link", async () => {
    const res = await post(nearby, { lat: 28.6358, lng: 77.2945 });
    expect(res.status).toBe(200);
    const body = EmergencyNearbyRes.parse(await res.json());
    expect(body.area).toBe("[mock] Preet Vihar, Delhi");
    expect(body.hospitals).toHaveLength(1);
    expect(body.hospitals[0]).toMatchObject({ name: "[mock] City Emergency Hospital", phone: "011-2345 6789", has_emergency: true, has_icu: null });
    expect(body.hospitals[0].maps_url.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
  });

  it("serves the same ~1 km area from cache", async () => {
    await post(nearby, { lat: 28.6358, lng: 77.2945 });
    const again = EmergencyNearbyRes.parse(await (await post(nearby, { lat: 28.6361, lng: 77.2949 })).json());
    expect(again.cached).toBe(true);
  });

  it("never fails: a broken map service and an empty table still answer 200 with no hospitals", async () => {
    vi.stubEnv("WEB_MOCK", "0");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    db.rows.hospitals = [];
    const res = await post(nearby, { lat: 12.97, lng: 77.59 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ area: null, hospitals: [], cached: false });
  });

  it("still checks sign-in and the body", async () => {
    expect((await post(nearby, { lat: 28.6, lng: 77.2 }, null)).status).toBe(401);
    expect((await post(nearby, { lat: 128.6, lng: 77.2 })).status).toBe(400);
  });
});

describe("POST /api/emergency/sos", () => {
  beforeEach(() => {
    db.rows.emergency_contacts = [
      { patient_id: USER_ID, name: "Sunita Sharma", phone: "+91 00000 00006" },
      { patient_id: "someone-else", name: "Not mine", phone: "+91 00000 00009" },
    ];
  });

  it("creates the request, returns contacts, hospitals and the SMS, and schedules the simulated status", async () => {
    const res = await post(sos, { lat: 28.6358, lng: 77.2945, note: "chest pain" });
    expect(res.status).toBe(200);
    const body = EmergencySosRes.parse(await res.json());
    expect(body.status).toBe("requested");
    expect(body.eta_minutes).toBeGreaterThanOrEqual(8);
    expect(body.eta_minutes).toBeLessThanOrEqual(15);
    expect(body.contacts).toEqual([{ name: "Sunita Sharma", phone: "+91 00000 00006" }]);
    expect(body.sms_body).toBe("EMERGENCY: Demo Patient needs help. Location: https://maps.google.com/?q=28.6358,77.2945. Sent from Vyana.");
    expect(body.hospitals).toHaveLength(1);
    const row = db.rows.emergency_requests.find((r) => r.id === body.request_id);
    expect(row).toMatchObject({ patient_id: USER_ID, note: "chest pain", status: "requested", area: "[mock] Preet Vihar, Delhi" });
    expect(scheduled).toHaveLength(1);
  });

  it("is for patients only", async () => {
    db.rows.profiles[0].role = "doctor";
    expect((await post(sos, { lat: 28.6, lng: 77.2 })).status).toBe(403);
    expect(scheduled).toHaveLength(0);
  });

  it("rejects an over-long note", async () => {
    expect((await post(sos, { lat: 28.6, lng: 77.2, note: "x".repeat(501) })).status).toBe(400);
  });

  it("moves the request to dispatched, then arriving, but leaves a cancelled one alone", async () => {
    db.rows.emergency_requests = [
      { id: "req-1", status: "requested" },
      { id: "req-2", status: "requested" },
    ];
    const waits: number[] = [];
    await simulateAmbulance("req-1", async (ms) => void waits.push(ms));
    expect(db.rows.emergency_requests[0].status).toBe("arriving");
    expect(waits).toEqual([20_000, 40_000]);

    await simulateAmbulance("req-2", async () => {
      db.rows.emergency_requests[1].status = "cancelled";
    });
    expect(db.rows.emergency_requests[1].status).toBe("cancelled");
  });
});

describe("POST /api/hospitals/info", () => {
  const H = "51000000-0000-4000-8000-000000000001";
  beforeEach(() => {
    db.rows.hospitals = [{ id: H, name: "All India Institute of Medical Sciences, New Delhi", website: "https://www.aiims.edu", opd_info: null, opd_info_fetched_at: null }];
  });

  it("returns OPD rows found on the page and saves them for 7 days", async () => {
    const first = HospitalInfoRes.parse(await (await post(info, { hospital_id: H })).json());
    expect(first.cached).toBe(false);
    expect(first.opd).toEqual([{ department: "General Medicine", days: "Monday to Saturday", timings: "9:00 AM to 1:00 PM" }]);
    expect(first.source_url).toBeTruthy();
    expect(db.rows.hospitals[0].opd_info).toMatchObject({ opd: first.opd });

    const second = HospitalInfoRes.parse(await (await post(info, { hospital_id: H })).json());
    expect(second.cached).toBe(true);
    expect(second.opd).toEqual(first.opd);
  });

  it("refreshes info older than 7 days", async () => {
    db.rows.hospitals[0].opd_info = { opd: [], notes: null, source_url: null };
    db.rows.hospitals[0].opd_info_fetched_at = new Date(Date.now() - 8 * 86_400_000).toISOString();
    const res = HospitalInfoRes.parse(await (await post(info, { hospital_id: H })).json());
    expect(res.cached).toBe(false);
    expect(res.opd).toHaveLength(1);
  });

  it("404s for an unknown hospital and 400s for a bad id", async () => {
    expect((await post(info, { hospital_id: "52000000-0000-4000-8000-000000000009" })).status).toBe(404);
    expect((await post(info, { hospital_id: "not-a-uuid" })).status).toBe(400);
  });
});
