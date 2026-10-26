import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ShareRes } from "@vyana/shared";
import { ageFromDob, SHARE_TOKEN_FORMAT } from "@/lib/server/data/share";
import { memoryDb, type Row } from "../fixtures/memory-db";

const PATIENT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const NOW = new Date("2026-10-13T06:00:00Z");
const hex = (c: string) => c.repeat(48);
const T_MEDICAL = hex("a");
const T_TIMELINE = hex("b");
const T_EXPIRED = hex("c");
const T_REVOKED = hex("d");
const T_EDGE = hex("e");
const T_SCOPED = "9".repeat(48);
const T_MEDICAL_SCOPED = "8".repeat(48);

let db: ReturnType<typeof memoryDb>;
vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => db.sb,
  requireEnv: (name: string) => process.env[name] ?? "",
}));

const { GET } = await import("@/app/api/share/[token]/route");

const get = (token: string, headers: Record<string, string> = {}) =>
  GET(new Request(`http://localhost/api/share/${token}`, { headers }), { params: Promise.resolve({ token }) });

function world(): Record<string, Row[]> {
  return {
    share_links: [
      { token: T_MEDICAL, patient_id: PATIENT, kind: "medical_id", expires_at: "2026-10-14T06:00:00Z", revoked: false },
      { token: T_TIMELINE, patient_id: PATIENT, kind: "timeline", expires_at: "2026-10-14T06:00:00Z", revoked: false },
      { token: T_EXPIRED, patient_id: PATIENT, kind: "medical_id", expires_at: "2026-10-13T05:59:59Z", revoked: false },
      { token: T_REVOKED, patient_id: PATIENT, kind: "medical_id", expires_at: "2026-10-20T00:00:00Z", revoked: true },
      { token: T_EDGE, patient_id: PATIENT, kind: "medical_id", expires_at: NOW.toISOString(), revoked: false },
      { token: T_SCOPED, patient_id: PATIENT, kind: "timeline", expires_at: "2026-10-14T06:00:00Z", revoked: false, scopes: ["labs", "adherence"], open_count: 2, last_opened_at: null },
      { token: T_MEDICAL_SCOPED, patient_id: PATIENT, kind: "medical_id", expires_at: "2026-10-14T06:00:00Z", revoked: false, scopes: ["labs"], open_count: 0, last_opened_at: null },
    ],
    profiles: [
      { id: PATIENT, full_name: "Aryan Sharma", dob: "1990-05-15", blood_group: "O+", allergies: ["Penicillin"], phone: "+91 00000 00001" },
      { id: OTHER, full_name: "Someone Else", dob: "1980-01-01", blood_group: "A+", allergies: ["Peanuts"] },
    ],
    conditions: [
      { id: "c1", patient_id: PATIENT, name: "Type 2 Diabetes", active: true, created_at: "2026-01-01T00:00:00Z", diagnosed_on: "2022-01-15", source: "doctor" },
      { id: "c2", patient_id: PATIENT, name: "Old sprain", active: false, created_at: "2026-01-02T00:00:00Z", diagnosed_on: "2020-02-02", source: "patient" },
      { id: "c3", patient_id: OTHER, name: "Asthma", active: true, created_at: "2026-01-03T00:00:00Z", diagnosed_on: null, source: "patient" },
    ],
    prescription_items: [
      { id: "i1", patient_id: PATIENT, medicine_name: "Metformin", strength: "500 mg", dose: "1 tablet", frequency: "BD", active: true, end_date: null, created_at: "2026-01-01T00:00:00Z" },
      { id: "i2", patient_id: PATIENT, medicine_name: "Antibiotic", strength: null, dose: null, frequency: "TDS", active: true, end_date: "2026-10-01", created_at: "2026-01-02T00:00:00Z" },
      { id: "i3", patient_id: PATIENT, medicine_name: "Switched off", strength: null, dose: null, frequency: "OD", active: false, end_date: null, created_at: "2026-01-03T00:00:00Z" },
      { id: "i4", patient_id: OTHER, medicine_name: "Not mine", strength: null, dose: null, frequency: "OD", active: true, end_date: null, created_at: "2026-01-04T00:00:00Z" },
    ],
    emergency_contacts: [
      { patient_id: PATIENT, name: "Sunita Sharma", phone: "+91 00000 00006", created_at: "2026-01-01T00:00:00Z" },
      { patient_id: OTHER, name: "Not mine", phone: "+91 00000 00099", created_at: "2026-01-01T00:00:00Z" },
    ],
    prescriptions: [
      { id: "rx1", patient_id: PATIENT, issued_on: "2026-09-29", diagnosis: "Type 2 Diabetes", doctor_name: "Dr. Rajesh Mehta", source: "doctor" },
      { id: "rx2", patient_id: OTHER, issued_on: "2026-09-01", diagnosis: "Asthma", doctor_name: null, source: "upload" },
    ],
    lab_reports: [
      { id: "lab1", patient_id: PATIENT, report_date: "2026-10-06", created_at: "2026-10-06T10:00:00Z", lab_name: "Sample Diagnostics", summary: "HbA1c improved to 6.8%." },
    ],
    lab_values: [
      { id: "lv1", patient_id: PATIENT, test_name: "HbA1c", value: 6.8, value_text: null, unit: "%", flag: "normal", ref_low: 4.0, ref_high: 5.6, measured_on: "2026-07-06" },
      { id: "lv2", patient_id: PATIENT, test_name: "HbA1c", value: 7.4, value_text: null, unit: "%", flag: "high", ref_low: 4.0, ref_high: 5.6, measured_on: "2026-10-06" },
      { id: "lv3", patient_id: OTHER, test_name: "SecretTest", value: 1, value_text: null, unit: "x", flag: "normal", ref_low: null, ref_high: null, measured_on: "2026-10-06" },
    ],
    vitals: [
      { id: "v1", patient_id: PATIENT, type: "bp", value: 120, value2: 80, unit: "mmHg", measured_at: "2026-10-10T04:00:00Z" },
    ],
    dose_logs: [
      { id: "dl1", patient_id: PATIENT, item_id: "i1", scheduled_for: "2026-10-13T03:30:00Z", status: "taken" },
      { id: "dl2", patient_id: PATIENT, item_id: "i1", scheduled_for: "2026-10-12T03:30:00Z", status: "missed" },
      { id: "dl3", patient_id: OTHER, item_id: "i4", scheduled_for: "2026-10-13T03:30:00Z", status: "taken" },
    ],
    appointments: [
      { id: "ap1", patient_id: PATIENT, appointment_date: "2026-09-29", token_no: 12, status: "completed", reason: "Checkup", hospitals: { name: "AIIMS" }, departments: { name: "General Medicine" } },
    ],
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  db = memoryDb(world());
});
afterEach(() => {
  vi.useRealTimers();
});

describe("GET /api/share/[token]", () => {
  it("opens the medical ID of a valid link without any sign-in", async () => {
    const res = await get(T_MEDICAL);
    expect(res.status).toBe(200);
    const body = ShareRes.parse(await res.json());
    expect(body).toEqual({
      kind: "medical_id",
      profile: {
        full_name: "Aryan Sharma",
        age: 36,
        blood_group: "O+",
        allergies: ["Penicillin"],
        conditions: ["Type 2 Diabetes"],
        active_medicines: [{ name: "Metformin", strength: "500 mg", dose: "1 tablet", frequency: "BD" }],
        emergency_contacts: [{ name: "Sunita Sharma", phone: "+91 00000 00006" }],
      },
      timeline: null,
      memory: null,
      expires_at: "2026-10-14T06:00:00.000Z",
    });
  });

  it("tells caches, search engines and referrers to leave it alone", async () => {
    const res = await get(T_MEDICAL);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("referrer-policy")).toBe("no-referrer");
  });

  it("keeps the 404 out of caches and search engines too", async () => {
    for (const t of [T_EXPIRED, T_REVOKED, hex("f"), "short"]) {
      const res = await get(t);
      expect(res.status).toBe(404);
      expect(res.headers.get("cache-control"), t).toBe("no-store");
      expect(res.headers.get("x-robots-tag"), t).toBe("noindex, nofollow");
      expect(res.headers.get("referrer-policy"), t).toBe("no-referrer");
    }
  });

  it("leaves out inactive conditions, switched-off and ended medicines, and everything of another patient", async () => {
    const text = JSON.stringify(await (await get(T_MEDICAL)).json());
    for (const hidden of ["Old sprain", "Switched off", "Antibiotic", "Not mine", "Asthma", "Peanuts", "Someone Else"]) expect(text).not.toContain(hidden);
  });

  it("does not hand out the patient id, the token or contact details of the patient themselves", async () => {
    const text = JSON.stringify(await (await get(T_MEDICAL)).json());
    expect(text).not.toContain(PATIENT);
    expect(text).not.toContain(T_MEDICAL);
    expect(text).not.toContain("+91 00000 00001"); // the patient's own phone
  });

  it("opens a timeline link: the basics without emergency contacts, and the history newest first", async () => {
    const res = await get(T_TIMELINE);
    expect(res.status).toBe(200);
    const body = ShareRes.parse(await res.json());
    expect(body.kind).toBe("timeline");
    expect(body.profile.full_name).toBe("Aryan Sharma");
    expect(body.profile.emergency_contacts).toEqual([]);
    expect(body.timeline?.map((e) => [e.date, e.kind])).toEqual([
      ["2026-10-06", "report"],
      ["2026-09-29", "appointment"],
      ["2026-09-29", "prescription"],
      ["2022-01-15", "condition"],
      ["2020-02-02", "condition"],
    ]);
    expect(body.timeline?.[0]).toMatchObject({ title: "Lab report: Sample Diagnostics", summary: "HbA1c improved to 6.8%." });
    expect(JSON.stringify(body)).not.toContain("Asthma"); // another patient's prescription and condition
  });

  it("lists a medicine whose last day is today in India, and drops it from the next day there", async () => {
    // Antibiotic ends 2026-10-01. At 2026-10-01 20:00 UTC it is already 2 October in India, so it is over.
    vi.setSystemTime(new Date("2026-10-01T20:00:00Z"));
    db.table("share_links").find((l) => l.token === T_MEDICAL)!.expires_at = "2026-10-05T00:00:00Z";
    let names = ((await (await get(T_MEDICAL)).json()) as { profile: { active_medicines: { name: string }[] } }).profile.active_medicines.map((m) => m.name);
    expect(names).not.toContain("Antibiotic");
    vi.setSystemTime(new Date("2026-10-01T18:00:00Z")); // 23:30 on 1 October in India
    names = ((await (await get(T_MEDICAL)).json()) as { profile: { active_medicines: { name: string }[] } }).profile.active_medicines.map((m) => m.name);
    expect(names).toContain("Antibiotic");
  });

  it("answers 404 for an expired link, even by a second", async () => {
    const res = await get(T_EXPIRED);
    expect(res.status).toBe(404);
    expect((await res.json()).error.code).toBe("NOT_FOUND");
  });

  it("answers 404 for a link that expires at this very moment", async () => {
    expect((await get(T_EDGE)).status).toBe(404);
  });

  it("answers 404 for a revoked link, and for one that never existed", async () => {
    expect((await get(T_REVOKED)).status).toBe(404);
    expect((await get(hex("f"))).status).toBe(404);
  });

  it("gives the same answer for every kind of 404, so nobody can tell them apart", async () => {
    const bodies = await Promise.all([T_EXPIRED, T_REVOKED, hex("f"), "short", "../etc/passwd"].map(async (t) => (await get(t)).json().then((j) => JSON.stringify(j.error))));
    expect(new Set(bodies).size).toBe(1);
    expect(bodies[0]).toContain("expired or was turned off");
  });

  it("never asks the database about something that cannot be a token", async () => {
    for (const bad of ["", "short", hex("A"), hex("g"), "a".repeat(47), "a".repeat(49), `${hex("a")}%20`, "../../x", "' or 1=1 --"]) {
      expect((await get(bad)).status, bad).toBe(404);
    }
    expect(db.requests).toHaveLength(0);
  });

  it("does not take a signed-in user's token as a shortcut", async () => {
    expect((await get(hex("f"), { authorization: "Bearer anything" })).status).toBe(404);
  });

  it("opens again after the link is renewed, and closes when it is revoked", async () => {
    expect((await get(T_MEDICAL)).status).toBe(200);
    db.table("share_links").find((l) => l.token === T_MEDICAL)!.revoked = true;
    expect((await get(T_MEDICAL)).status).toBe(404);
  });
});

describe("GET /api/share/[token] with scopes (the Health Memory Graph, #237)", () => {
  it("returns memory with only the sections the link's scopes name", async () => {
    const res = await get(T_SCOPED);
    expect(res.status).toBe(200);
    const body = ShareRes.parse(await res.json());
    expect(body.memory?.labs).toEqual([
      {
        test_name: "HbA1c",
        unit: "%",
        ref_low: 4.0,
        ref_high: 5.6,
        points: [
          { date: "2026-07-06", value: 6.8, flag: "normal" },
          { date: "2026-10-06", value: 7.4, flag: "high" },
        ],
      },
    ]);
    expect(body.memory?.adherence?.days).toHaveLength(30);
    expect(body.memory?.adherence?.days[29]).toEqual({ date: "2026-10-13", taken: 1, missed: 0, skipped: 0 });
    expect(body.memory?.adherence?.days[28]).toEqual({ date: "2026-10-12", taken: 0, missed: 1, skipped: 0 });
    expect(body.memory?.adherence?.percent_taken).toBe(50);
    // The vitals and medicines rows exist, but those scopes are off: their keys are not there at all.
    expect(body.memory?.vitals).toBeUndefined();
    expect(body.memory?.medicines).toBeUndefined();
    expect(JSON.stringify(body)).not.toContain("SecretTest");
  });

  it("never puts the memory on a medical ID link, even one created with scopes", async () => {
    const res = await get(T_MEDICAL_SCOPED);
    expect(res.status).toBe(200);
    const body = ShareRes.parse(await res.json());
    expect(body.kind).toBe("medical_id");
    expect(body.memory).toBeNull();
  });

  it("counts the open on the link, with the time", async () => {
    await get(T_SCOPED);
    const link = db.table("share_links").find((l) => l.token === T_SCOPED)!;
    expect(link.open_count).toBe(3);
    expect(link.last_opened_at).toBe(NOW.toISOString());
    await get(T_SCOPED);
    expect(db.table("share_links").find((l) => l.token === T_SCOPED)!.open_count).toBe(4);
  });

  it("counts a plain link too, and its memory stays null", async () => {
    const body = ShareRes.parse(await (await get(T_MEDICAL)).json());
    expect(body.memory).toBeNull();
    expect(db.table("share_links").find((l) => l.token === T_MEDICAL)!.open_count).toBe(1);
  });

  it("does not count a link that does not open", async () => {
    expect((await get(T_EXPIRED)).status).toBe(404);
    expect((await get(T_REVOKED)).status).toBe(404);
    expect(db.table("share_links").find((l) => l.token === T_EXPIRED)!.open_count).toBeUndefined();
    expect(db.table("share_links").find((l) => l.token === T_REVOKED)!.open_count).toBeUndefined();
  });
});

describe("token format", () => {
  it("is 48 lower-case hex characters, what gen_random_bytes(24) produces", () => {
    expect(SHARE_TOKEN_FORMAT.test(hex("a"))).toBe(true);
    expect(SHARE_TOKEN_FORMAT.test("0123456789abcdef".repeat(3))).toBe(true);
    expect(SHARE_TOKEN_FORMAT.test(hex("A"))).toBe(false);
  });
});

// The share memory's vitals carry a device mark only when the fetch selects the source column:
// buildMemory sets from_device from r.source, and the real database returns exactly the columns
// the select lists. The in-memory fake below returns whole rows whatever the select says, so a
// behaviour test through it cannot catch a missing column — this test reads the select instead,
// the same way the rate-limit test reads the route files.
describe("the share memory's vitals fetch", () => {
  it("selects the vitals source column, so device readings keep their from-device mark", () => {
    const source = readFileSync(resolve(__dirname, "../../lib/server/data/share.ts"), "utf8");
    const columns = /from\("vitals"\)\.select\("([^"]+)"\)/.exec(source)?.[1].split(",").map((c) => c.trim()) ?? [];
    expect(columns).toContain("source");
  });
});

describe("ageFromDob", () => {
  const today = new Date("2026-10-13T06:00:00Z");
  it("counts whole years and the birthday itself", () => {
    expect(ageFromDob("1990-10-13", today)).toBe(36);
    expect(ageFromDob("1990-10-14", today)).toBe(35);
    expect(ageFromDob("1990-05-15", today)).toBe(36);
    expect(ageFromDob("2026-10-13", today)).toBe(0);
  });
  it("counts the day in India: after 18:30 UTC it is already the next day there", () => {
    // 2026-10-12 19:00 UTC is 2026-10-13 00:30 in India: the birthday has come.
    expect(ageFromDob("1990-10-13", new Date("2026-10-12T19:00:00Z"))).toBe(36);
    expect(ageFromDob("1990-10-13", new Date("2026-10-12T18:29:00Z"))).toBe(35);
  });
  it("is null without a usable date, or for a date in the future", () => {
    expect(ageFromDob(null, today)).toBeNull();
    expect(ageFromDob("", today)).toBeNull();
    expect(ageFromDob("not-a-date", today)).toBeNull();
    expect(ageFromDob("2030-01-01", today)).toBeNull();
  });
});
