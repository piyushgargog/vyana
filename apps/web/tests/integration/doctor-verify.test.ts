import { beforeEach, describe, expect, it, vi } from "vitest";
import { DoctorVerifyRes } from "@vyana/shared";
import { OTHER_USER_ID, USER_ID, VALID_TOKEN, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const { POST } = await import("@/app/api/doctors/verify/route");

const post = (body: unknown, token = VALID_TOKEN) =>
  POST(
    new Request("http://localhost/api/doctors/verify", {
      method: "POST",
      headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify(body),
    }),
    undefined,
  );

const THIRD_DOCTOR_ID = "11111111-2222-4333-8444-555555555555";
const row = (id: string) => db.rows.doctors.find((d) => d.id === id) as Record<string, unknown>;
const asDoctor = () => Object.assign(db.rows.profiles[0], { role: "doctor", full_name: "Dr. Sneha Gupta" });
const asAdmin = () => Object.assign(db.rows.profiles[0], { role: "admin", full_name: "Admin" });

const send = { reg_no: "12345", state_council: "Delhi Medical Council", year_of_registration: 2011 };

beforeEach(() => {
  resetDb();
  asDoctor();
  db.rows.doctors = [
    { id: USER_ID, reg_no: "old-reg", state_council: "Delhi Medical Council", verification_status: "pending", verified_at: null },
  ];
});

describe("POST /api/doctors/verify", () => {
  it("saves a doctor's registration and leaves it pending for a manual check", async () => {
    const res = await post(send);
    expect(res.status).toBe(200);
    const body = DoctorVerifyRes.parse(await res.json());
    expect(body).toMatchObject({ status: "pending", match: null });
    expect(row(USER_ID)).toMatchObject({
      verification_status: "pending",
      reg_no: "12345",
      state_council: "Delhi Medical Council",
      year_of_registration: 2011,
      verified_at: null,
    });
    const json = row(USER_ID).verification_json as { method: string; submitted_at: string };
    expect(json.method).toBe("manual");
    expect(json.submitted_at).toBeTruthy();
  });

  it("keeps a verified doctor verified when they send the same number and council again", async () => {
    Object.assign(row(USER_ID), {
      reg_no: "12345",
      verification_status: "verified",
      verified_at: "2026-01-01T00:00:00.000Z",
      verification_json: { method: "manual", checked_by: "an-admin" },
    });
    // The same registration written the way the register writes it: still the same number and council.
    const body = DoctorVerifyRes.parse(await (await post({ reg_no: "12-345", state_council: "Medical Council of Delhi" })).json());
    expect(body.status).toBe("verified");
    expect(row(USER_ID).verification_status).toBe("verified");
    expect(row(USER_ID).verified_at).toBe("2026-01-01T00:00:00.000Z");
  });

  it("sends a verified doctor back to pending when the number changes", async () => {
    Object.assign(row(USER_ID), {
      reg_no: "12345",
      verification_status: "verified",
      verified_at: "2026-01-01T00:00:00.000Z",
    });
    const body = DoctorVerifyRes.parse(await (await post({ reg_no: "67890", state_council: "Delhi Medical Council" })).json());
    expect(body.status).toBe("pending");
    expect(row(USER_ID)).toMatchObject({ verification_status: "pending", reg_no: "67890", verified_at: null });
  });

  it("records an admin's approval with the values the admin typed", async () => {
    asAdmin();
    db.rows.doctors = [{ id: OTHER_USER_ID, reg_no: "claimed-1", state_council: "Delhi Medical Council", verification_status: "pending", verified_at: null }];
    const res = await post({
      doctor_id: OTHER_USER_ID,
      decision: "approve",
      reg_no: "DMC/2020/123",
      state_council: "Delhi Medical Council",
      year: 2020,
      note: "Found in the register.",
    });
    expect(res.status).toBe(200);
    const body = DoctorVerifyRes.parse(await res.json());
    expect(body.status).toBe("verified");
    const saved = row(OTHER_USER_ID);
    expect(saved).toMatchObject({
      verification_status: "verified",
      reg_no: "DMC/2020/123",
      state_council: "Delhi Medical Council",
      year_of_registration: 2020,
    });
    expect(saved.verified_at).toBeTruthy();
    const json = saved.verification_json as { method: string; checked_by: string; note: string };
    expect(json).toMatchObject({ method: "manual", checked_by: USER_ID, note: "Found in the register." });
  });

  it("records an admin's rejection as failed and keeps the saved number", async () => {
    asAdmin();
    db.rows.doctors = [{ id: OTHER_USER_ID, reg_no: "claimed-1", state_council: "Delhi Medical Council", verification_status: "pending", verified_at: null }];
    const res = await post({
      doctor_id: OTHER_USER_ID,
      decision: "reject",
      reg_no: "not-in-the-register",
      state_council: "Delhi Medical Council",
      year: null,
      note: "No such entry.",
    });
    expect(res.status).toBe(200);
    const body = DoctorVerifyRes.parse(await res.json());
    expect(body.status).toBe("failed");
    expect(row(OTHER_USER_ID)).toMatchObject({ verification_status: "failed", reg_no: "claimed-1" });
  });

  it("refuses to approve a number already verified on another account, and changes nothing", async () => {
    asAdmin();
    db.rows.doctors = [
      { id: OTHER_USER_ID, reg_no: "12345", state_council: "Delhi Medical Council", verification_status: "verified", verified_at: "2026-01-01T00:00:00.000Z" },
      { id: THIRD_DOCTOR_ID, reg_no: "waiting", state_council: "Delhi Medical Council", verification_status: "pending", verified_at: null },
    ];
    const res = await post({
      doctor_id: THIRD_DOCTOR_ID,
      decision: "approve",
      reg_no: "12 345",
      state_council: "Medical Council of Delhi",
      year: 2011,
      note: "Looks right.",
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; message: string } };
    expect(body.error.message).toBe("This registration is already linked to another account.");
    expect(row(THIRD_DOCTOR_ID)).toMatchObject({ verification_status: "pending", reg_no: "waiting" });
    expect(row(OTHER_USER_ID)).toMatchObject({ verification_status: "verified", reg_no: "12345" });
  });

  it("answers 404 when an admin checks a doctor who does not exist", async () => {
    asAdmin();
    db.rows.doctors = [];
    const res = await post({ doctor_id: OTHER_USER_ID, decision: "approve", reg_no: "1", state_council: "Delhi Medical Council", year: null, note: "" });
    expect(res.status).toBe(404);
  });

  it("is for doctors and admins only, with the body that fits the role", async () => {
    // A patient gets 403, whichever body they send.
    db.rows.profiles[0].role = "patient";
    expect((await post(send)).status).toBe(403);
    expect((await post({ doctor_id: USER_ID, decision: "approve", reg_no: "1", state_council: "Delhi Medical Council", year: null, note: "" })).status).toBe(403);
    // A doctor who sends an admin's body gets 400: `decision` is not part of what a doctor sends.
    asDoctor();
    expect((await post({ doctor_id: USER_ID, decision: "approve", reg_no: "12345", state_council: "Delhi Medical Council", year: 2011, note: "" })).status).toBe(400);
    // An admin who sends a doctor's body gets 400: the admin fields are missing.
    asAdmin();
    expect((await post(send)).status).toBe(400);
    // No sign-in at all, and a broken doctor body.
    expect((await post(send, "")).status).toBe(401);
    asDoctor();
    expect((await post({ reg_no: "", state_council: "x" })).status).toBe(400);
  });

  it("asks a doctor without a doctor profile to complete it first", async () => {
    db.rows.doctors = [];
    const res = await post(send);
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: { message: string } };
    expect(body.error.message).toBe("Complete your doctor profile first.");
  });

  it("never claims an automatic check: no register wording in the answer or the saved row", async () => {
    const res = await post(send);
    const text = JSON.stringify(await res.json()) + JSON.stringify(db.rows.doctors);
    expect(text).not.toContain("NMC");
    expect(text).not.toContain("verified automatically");
    asAdmin();
    db.rows.doctors = [{ id: OTHER_USER_ID, reg_no: "claimed-1", state_council: "Delhi Medical Council", verification_status: "pending", verified_at: null }];
    const adminRes = await post({ doctor_id: OTHER_USER_ID, decision: "approve", reg_no: "DMC/1", state_council: "Delhi Medical Council", year: 2001, note: "Checked by hand." });
    const adminText = JSON.stringify(await adminRes.json()) + JSON.stringify(db.rows.doctors);
    expect(adminText).not.toContain("NMC");
    expect(adminText).not.toContain("verified automatically");
  });
});
