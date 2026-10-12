import { describe, expect, it } from "vitest";

import { fakeSupabase } from "./fakeSupabase";
import {
  DbError,
  acceptCareInvite,
  acceptConsent,
  addCondition,
  addVital,
  approveCarePlan,
  bookAppointment,
  buildTimeline,
  computeAdherence,
  computeScheduledAdherence,
  listDueDoses,
  prepareDoctorItems,
  computeFreeSlots,
  createCareInvite,
  createDoctorPrescription,
  createShareLink,
  daysAgoIso,
  getAdherence,
  getSignedUrl,
  getTimeline,
  listActiveItems,
  listHospitals,
  listMyAppointments,
  listPrescriptions,
  listVerifiedDoctors,
  liveChannelName,
  subscribeTable,
  logDose,
  markAlertSeen,
  randomUuid,
  reportAiMistake,
  requireUserId,
  revokeCareLink,
  revokeShareLink,
  savePushToken,
  shareUrl,
  startOfLocalDay,
  startOfNextLocalDay,
  toLocalDate,
  trimTrailingSlashes,
  unwrap,
  unwrapOrNull,
  updateAppointmentStatus,
  updateMyProfile,
  uploadFile,
} from "./index";

const ok = (data: unknown) => ({ data, error: null });
const fail = (message: string, code?: string) => ({ data: null, error: { message, code: code ?? "", details: "" } });

describe("helpers", () => {
  it("unwrap returns the data, or throws a DbError with the Postgres code", () => {
    expect(unwrap(ok({ a: 1 }))).toEqual({ a: 1 });
    expect(() => unwrap(fail("permission denied", "42501"))).toThrow(DbError);
    try {
      unwrap(fail("duplicate", "23505"));
    } catch (e) {
      expect((e as DbError).code).toBe("23505");
      expect((e as DbError).name).toBe("DbError");
    }
    expect(() => unwrap(ok(null))).toThrow("No data returned");
  });

  it("unwrapOrNull turns a missing row into null but still throws on errors", () => {
    expect(unwrapOrNull(ok(null))).toBeNull();
    expect(unwrapOrNull(ok({ id: 1 }))).toEqual({ id: 1 });
    expect(() => unwrapOrNull(fail("boom"))).toThrow(DbError);
  });

  it("requireUserId reads the local session and refuses when signed out", async () => {
    expect(await requireUserId(fakeSupabase({ userId: "abc" }).sb)).toBe("abc");
    await expect(requireUserId(fakeSupabase({ userId: null }).sb)).rejects.toMatchObject({ code: "not_signed_in" });
  });

  it("works with local calendar days", () => {
    expect(toLocalDate(new Date(2026, 9, 5))).toBe("2026-10-05");
    expect(new Date(startOfLocalDay("2026-10-05")).getDate()).toBe(5);
    expect(new Date(startOfNextLocalDay("2026-10-31")).getMonth()).toBe(10); // November
    expect(daysAgoIso(1, new Date("2026-10-12T00:00:00Z"))).toBe("2026-10-11T00:00:00.000Z");
  });
});

describe("profile", () => {
  it("updates only the signed-in user's own row", async () => {
    const f = fakeSupabase({ responses: { profiles: [ok({ id: "user-1", city: "Delhi" })] } });
    const row = await updateMyProfile(f.sb, { city: "Delhi" });
    expect(row.city).toBe("Delhi");
    expect(f.chainOf(0).map((c) => c.name)).toEqual(["update", "eq", "select", "single"]);
    expect(f.argsOf("update")).toEqual([{ city: "Delhi" }]);
    expect(f.argsOf("eq")).toEqual(["id", "user-1"]);
  });
});

describe("prescriptions", () => {
  it("lists the patient's own prescriptions with their medicines", async () => {
    const f = fakeSupabase({ responses: { prescriptions: [ok([])] } });
    await listPrescriptions(f.sb);
    expect(f.argsOf("select")).toEqual(["*, prescription_items(*)"]);
    expect(f.argsOf("eq")).toEqual(["patient_id", "user-1"]);
  });

  it("lists another patient's prescriptions for a doctor", async () => {
    const f = fakeSupabase({ responses: { prescriptions: [ok([])] } });
    await listPrescriptions(f.sb, "patient-9");
    expect(f.argsOf("eq")).toEqual(["patient_id", "patient-9"]);
  });

  it("writes an e-Rx in the doctor's name, adds the medicines and returns the condition", async () => {
    const f = fakeSupabase({
      userId: "doc-1",
      responses: {
        prescriptions: [ok({ id: "rx-1", patient_id: "pat-1", doctor_id: "doc-1" })],
        prescription_items: [ok([{ id: "i-1", medicine_name: "Metformin" }])],
        conditions: [ok({ id: "cond-1" })],
      },
    });
    const result = await createDoctorPrescription(f.sb, {
      patient_id: "pat-1",
      diagnosis: "Type 2 Diabetes",
      items: [{ medicine_name: "Metformin", frequency: "BD" }],
    });

    expect(f.argsOf("insert", 0)).toEqual([
      { patient_id: "pat-1", doctor_id: "doc-1", appointment_id: null, source: "doctor", diagnosis: "Type 2 Diabetes", notes: null },
    ]);
    expect(f.argsOf("insert", 1)).toEqual([
      [{ medicine_name: "Metformin", frequency: "BD", times: ["09:00", "21:00"], prescription_id: "rx-1", patient_id: "pat-1" }],
    ]);
    expect(f.calls.filter((c) => c.name === "from").map((c) => c.args[0])).toEqual(["prescriptions", "prescription_items", "conditions"]);
    expect(result.condition_id).toBe("cond-1");
    expect(result.items).toHaveLength(1);
  });

  it("returns condition_id null while nothing has created the condition yet", async () => {
    const f = fakeSupabase({
      userId: "doc-1",
      responses: { prescriptions: [ok({ id: "rx-1" })], prescription_items: [ok([{ id: "i-1" }])], conditions: [ok(null)] },
    });
    const result = await createDoctorPrescription(f.sb, { patient_id: "p", diagnosis: "d", items: [{ medicine_name: "x", frequency: "OD" }] });
    expect(result.condition_id).toBeNull();
  });

  it("refuses a prescription without medicines before touching the database", async () => {
    const f = fakeSupabase({ userId: "doc-1" });
    await expect(createDoctorPrescription(f.sb, { patient_id: "p", diagnosis: "d", items: [] })).rejects.toThrow("at least one medicine");
    expect(f.calls).toHaveLength(0);
  });

  it("lists active medicines that have not ended", async () => {
    const f = fakeSupabase({ responses: { prescription_items: [ok([])] } });
    await listActiveItems(f.sb, "2026-10-12");
    expect(f.calls.filter((c) => c.name === "eq").map((c) => c.args)).toEqual([
      ["patient_id", "user-1"],
      ["active", true],
    ]);
    expect(f.argsOf("or")).toEqual(["end_date.is.null,end_date.gte.2026-10-12"]);
  });
});

describe("prepareDoctorItems", () => {
  it("fills the reminder times of the frequency when the doctor gave none", () => {
    const [bd, sos, custom] = prepareDoctorItems([
      { medicine_name: " Metformin ", frequency: "BD" },
      { medicine_name: "Dolo", frequency: "SOS" },
      { medicine_name: "Vitamin", frequency: "custom", times: ["07:30"] },
    ]);
    expect(bd).toMatchObject({ medicine_name: "Metformin", times: ["09:00", "21:00"] });
    expect(sos.times).toEqual([]);
    expect(custom.times).toEqual(["07:30"]);
  });

  it("stops on a bad medicine before anything is saved", () => {
    expect(() => prepareDoctorItems([])).toThrow("at least one medicine");
    expect(() => prepareDoctorItems([{ medicine_name: "  ", frequency: "OD" }])).toThrow("Medicine 1: the name is missing");
    expect(() => prepareDoctorItems([{ medicine_name: "x", frequency: "WEEKLY" as never }])).toThrow('unknown frequency "WEEKLY"');
    expect(() => prepareDoctorItems([{ medicine_name: "x", frequency: "OD", times: ["9am"] }])).toThrow("not a time like 09:00");
    expect(() => prepareDoctorItems([{ medicine_name: "x", frequency: "OD", times: ["24:00"] }])).toThrow("not a time");
    expect(() => prepareDoctorItems([{ medicine_name: "ok", frequency: "OD" }, { medicine_name: "x", frequency: "OD", quantity_total: 0 }])).toThrow(
      "Medicine 2: the quantity must be more than 0"
    );
  });

  it("writes nothing when a medicine is invalid", async () => {
    const f = fakeSupabase({ userId: "doc-1" });
    await expect(createDoctorPrescription(f.sb, { patient_id: "p", diagnosis: "d", items: [{ medicine_name: "", frequency: "OD" }] })).rejects.toMatchObject({
      code: "invalid_prescription",
    });
    expect(f.calls).toHaveLength(0);
  });
});

describe("doses", () => {
  it("logs one row per medicine and due time", async () => {
    const f = fakeSupabase({ responses: { dose_logs: [ok({ id: "d-1", status: "taken" })] } });
    await logDose(f.sb, { item_id: "i-1", scheduled_for: "2026-10-12T09:00:00.000Z", status: "taken" });
    const [row, opts] = f.argsOf("upsert") as [Record<string, unknown>, unknown];
    expect(row).toMatchObject({ patient_id: "user-1", item_id: "i-1", scheduled_for: "2026-10-12T09:00:00.000Z", status: "taken" });
    expect(opts).toEqual({ onConflict: "item_id,scheduled_for" });
  });

  it("computes adherence from taken and missed, leaving skipped doses out", () => {
    expect(computeAdherence([])).toEqual({ taken: 0, missed: 0, percent: 0 });
    expect(computeAdherence([{ status: "taken" }, { status: "taken" }, { status: "missed" }, { status: "skipped" }])).toEqual({
      taken: 2,
      missed: 1,
      percent: 67,
    });
    expect(computeAdherence([{ status: "missed" }])).toEqual({ taken: 0, missed: 1, percent: 0 });
    expect(computeAdherence([{ status: "taken" }])).toEqual({ taken: 1, missed: 0, percent: 100 });
  });

  it("reads the last N days of logs and the active medicines for the adherence", async () => {
    const f = fakeSupabase({
      responses: {
        dose_logs: [ok([{ item_id: "i-1", scheduled_for: "2026-10-12T03:30:00.000Z", status: "taken" }, { item_id: "i-1", scheduled_for: "2026-10-11T03:30:00.000Z", status: "missed" }])],
        prescription_items: [ok([])],
      },
    });
    const now = new Date("2026-10-12T12:00:00Z");
    expect(await getAdherence(f.sb, 7, now)).toEqual({ taken: 1, missed: 1, percent: 50 });
    expect(f.argsOf("gte")).toEqual(["scheduled_for", "2026-10-05T12:00:00.000Z"]);
    expect(f.argsOf("lt")).toEqual(["scheduled_for", "2026-10-12T12:00:00.000Z"]);
    expect(f.calls.filter((c) => c.name === "eq").map((c) => c.args)).toContainEqual(["active", true]);
  });
});

describe("scheduled adherence", () => {
  // local times, so the test does not depend on the time zone of the machine
  const at = (day: number, hh: number, mm = 0) => new Date(2026, 9, day, hh, mm);
  const bd = { id: "i-1", times: ["09:00", "21:00"], start_date: "2026-10-01", end_date: null };

  it("lists doses that are overdue by more than the grace period, and no others", () => {
    const now = at(12, 22, 30); // 21:00 was 90 minutes ago, 09:00 too
    const due = listDueDoses([bd], at(11, 0), now);
    expect(due.map((d) => d.due.getTime())).toEqual([at(11, 9), at(11, 21), at(12, 9), at(12, 21)].map((d) => d.getTime()));
    // 21:30 is only 30 minutes after the 21:00 dose: inside the 60 minute grace
    expect(listDueDoses([bd], at(12, 0), at(12, 21, 30)).map((d) => d.due.getTime())).toEqual([at(12, 9).getTime()]);
  });

  it("respects the start date, the end date and as-needed medicines", () => {
    const now = at(12, 23);
    expect(listDueDoses([{ ...bd, start_date: "2026-10-12" }], at(11, 0), now)).toHaveLength(2);
    expect(listDueDoses([{ ...bd, end_date: "2026-10-11" }], at(11, 0), now)).toHaveLength(2);
    expect(listDueDoses([{ id: "i-2", times: [], start_date: "2026-10-01", end_date: null }], at(11, 0), now)).toHaveLength(0);
  });

  it("counts a dose that was due and never logged as missed", () => {
    const now = at(12, 23);
    const logs = [
      { item_id: "i-1", scheduled_for: at(12, 9).toISOString(), status: "taken" as const },
      { item_id: "i-1", scheduled_for: at(12, 21, 10).toISOString(), status: "taken" as const }, // logged 10 minutes off
    ];
    // due since 11 Oct: 4 doses (11th 09:00 and 21:00 unlogged) + 2 logged on the 12th
    expect(computeScheduledAdherence([bd], logs, at(11, 0), now)).toEqual({ taken: 2, missed: 2, percent: 50 });
  });

  it("does not count a logged dose twice, and leaves skipped ones out", () => {
    const now = at(12, 23);
    const logs = [
      { item_id: "i-1", scheduled_for: at(12, 9).toISOString(), status: "missed" as const },
      { item_id: "i-1", scheduled_for: at(12, 21).toISOString(), status: "skipped" as const },
    ];
    expect(computeScheduledAdherence([bd], logs, at(12, 0), now)).toEqual({ taken: 0, missed: 1, percent: 0 });
  });

  it("is 0 percent with nothing due and nothing logged", () => {
    expect(computeScheduledAdherence([], [], at(11, 0), at(12, 12))).toEqual({ taken: 0, missed: 0, percent: 0 });
  });
});

describe("hospitals and appointments", () => {
  it("lists hospitals and drops the nested department rows used for the filter", async () => {
    const f = fakeSupabase({ responses: { hospitals: [ok([{ id: "h-1", name: "AIIMS", departments: [{ id: "d" }] }])] } });
    const rows = await listHospitals(f.sb, { department: "cardio", kind: "government" });
    expect(rows).toEqual([{ id: "h-1", name: "AIIMS" }]);
    expect(f.argsOf("select")).toEqual(["*, departments!inner(id)"]);
    expect(f.argsOf("ilike")).toEqual(["departments.name", "%cardio%"]);
    expect(f.argsOf("eq")).toEqual(["kind", "government"]);
  });

  it("books through the book_appointment function with a null doctor and reason by default", async () => {
    const f = fakeSupabase({ responses: { "rpc:book_appointment": [ok({ id: "a-1", token_no: 4 })] } });
    const appt = await bookAppointment(f.sb, { hospital_id: "h", department_id: "d", appointment_date: "2026-10-13" });
    expect(appt.token_no).toBe(4);
    expect(f.argsOf("rpc")).toEqual([
      "book_appointment",
      { p_hospital: "h", p_department: "d", p_doctor: null, p_date: "2026-10-13", p_reason: null },
    ]);
  });

  it("passes the database's reason when a booking is refused", async () => {
    const f = fakeSupabase({ responses: { "rpc:book_appointment": [fail("OPD is closed on that day", "P0001")] } });
    await expect(bookAppointment(f.sb, { hospital_id: "h", department_id: "d", appointment_date: "2026-10-18" })).rejects.toMatchObject({
      message: "OPD is closed on that day",
      code: "P0001",
    });
  });

  it("lists my appointments with hospital and department names", async () => {
    const f = fakeSupabase({ responses: { appointments: [ok([])] } });
    await listMyAppointments(f.sb);
    expect(f.argsOf("select")).toEqual(["*, hospitals(name, address), departments(name)"]);
  });

  it("sends doctor notes only when given", async () => {
    const f = fakeSupabase({ responses: { appointments: [ok({}), ok({})] } });
    await updateAppointmentStatus(f.sb, "a-1", "confirmed");
    await updateAppointmentStatus(f.sb, "a-1", "completed", "all fine");
    expect(f.argsOf("update", 0)).toEqual([{ status: "confirmed" }]);
    expect(f.argsOf("update", 1)).toEqual([{ status: "completed", doctor_notes: "all fine" }]);
  });
});

describe("doctors", () => {
  const listing = (id: string, specialization: string) => ({ id, full_name: id, specialization });

  it("lists verified doctors through doctor_directory and filters the specialization text", async () => {
    const f = fakeSupabase({ responses: { "rpc:doctor_directory": [ok([listing("a", "General Physician"), listing("b", "Dermatologist")])] } });
    const rows = await listVerifiedDoctors(f.sb, { department_id: "d-1", specialization: "derma" });
    expect(rows.map((r) => r.id)).toEqual(["b"]);
    expect(f.argsOf("rpc")).toEqual(["doctor_directory", { p_hospital: undefined, p_department: "d-1" }]);
  });

  it("computes free slots from the weekly availability", () => {
    const availability = { days: [1, 2, 3, 4, 5, 6], start: "10:00", end: "11:30", slot_minutes: 30 };
    expect(computeFreeSlots(availability, "2026-10-12", [])).toEqual(["10:00", "10:30", "11:00"]); // a Monday
    expect(computeFreeSlots(availability, "2026-10-12", ["10:30"])).toEqual(["10:00", "11:00"]);
    expect(computeFreeSlots(availability, "2026-10-18", [])).toEqual([]); // a Sunday
    expect(computeFreeSlots({ ...availability, slot_minutes: 0 }, "2026-10-12", [])).toEqual([]);
    expect(computeFreeSlots({ ...availability, end: "10:20" }, "2026-10-12", [])).toEqual([]);
  });
});

describe("care plans, caregivers, sharing", () => {
  it("approves a plan in the doctor's name", async () => {
    const f = fakeSupabase({ userId: "doc-1", responses: { care_plans: [ok({ id: "cp-1", status: "approved" })] } });
    await approveCarePlan(f.sb, "cp-1", { v: 2 });
    const [patch] = f.argsOf("update") as [Record<string, unknown>];
    expect(patch).toMatchObject({ status: "approved", plan_json: { v: 2 }, reviewed_by: "doc-1" });
    expect(typeof patch.reviewed_at).toBe("string");
    expect(f.argsOf("eq")).toEqual(["id", "cp-1"]);
  });

  it("creates an invite code through the function", async () => {
    const f = fakeSupabase({ responses: { "rpc:create_care_invite": [ok("483920")] } });
    expect(await createCareInvite(f.sb)).toBe("483920");
  });

  it("returns null for a wrong code and the link for a right one", async () => {
    const wrong = fakeSupabase({ responses: { "rpc:accept_care_invite": [ok(null)] } });
    expect(await acceptCareInvite(wrong.sb, "000000")).toBeNull();
    const right = fakeSupabase({ responses: { "rpc:accept_care_invite": [ok({ id: "l-1", status: "active" })] } });
    expect(await acceptCareInvite(right.sb, "123456", "Daughter")).toMatchObject({ id: "l-1" });
    expect(right.argsOf("rpc")).toEqual(["accept_care_invite", { p_code: "123456", p_relation: "Daughter" }]);
  });

  it("raises 'too many attempts' as a DbError", async () => {
    const f = fakeSupabase({ responses: { "rpc:accept_care_invite": [fail("too many attempts, try again in 15 minutes", "P0001")] } });
    await expect(acceptCareInvite(f.sb, "1")).rejects.toThrow("too many attempts");
  });

  it("revokes a caregiver link", async () => {
    const f = fakeSupabase({ responses: { care_links: [ok({ id: "l-1", status: "revoked" })] } });
    await revokeCareLink(f.sb, "l-1");
    expect(f.argsOf("update")).toEqual([{ status: "revoked" }]);
  });

  it("builds share URLs without a double slash and without a regular expression", () => {
    expect(trimTrailingSlashes("https://vyana.app///")).toBe("https://vyana.app");
    expect(trimTrailingSlashes("///")).toBe("");
    expect(shareUrl("https://vyana.app/", "abc")).toBe("https://vyana.app/share/abc");
  });

  it("creates a share link that expires after the given hours and returns its URL", async () => {
    const f = fakeSupabase({ responses: { share_links: [ok({ token: "tok123", expires_at: "2026-10-13T00:00:00.000Z" })] } });
    const before = Date.now();
    const link = await createShareLink(f.sb, "medical_id", 24, "https://vyana.app/");
    expect(link).toEqual({ token: "tok123", url: "https://vyana.app/share/tok123", expires_at: "2026-10-13T00:00:00.000Z" });
    const [row] = f.argsOf("insert") as [{ patient_id: string; kind: string; expires_at: string }];
    expect(row).toMatchObject({ patient_id: "user-1", kind: "medical_id" });
    expect(new Date(row.expires_at).getTime() - before).toBeGreaterThanOrEqual(24 * 3600 * 1000 - 50);
    expect(f.argsOf("select")).toEqual(["token, expires_at"]);
  });

  it("revokes a share link by token", async () => {
    const f = fakeSupabase({ responses: { share_links: [ok(null)] } });
    await revokeShareLink(f.sb, "tok123");
    expect(f.argsOf("update")).toEqual([{ revoked: true }]);
    expect(f.argsOf("eq")).toEqual(["token", "tok123"]);
  });
});

describe("conditions, vitals, consents, alerts, AI runs, push", () => {
  it("adds a condition as the patient's own (never as a doctor's)", async () => {
    const f = fakeSupabase({ responses: { conditions: [ok({ id: "c" })] } });
    await addCondition(f.sb, { name: "Asthma" });
    expect(f.argsOf("insert")).toEqual([{ name: "Asthma", patient_id: "user-1", source: "patient" }]);
  });

  it("uses the standard unit of a vital when none is given", async () => {
    const f = fakeSupabase({ responses: { vitals: [ok({ id: "v" })] } });
    await addVital(f.sb, { type: "bp", value: 120, value2: 80 });
    expect(f.argsOf("insert")).toEqual([{ patient_id: "user-1", type: "bp", value: 120, value2: 80, unit: "mmHg" }]);
  });

  it("accepts a consent once and reads it back", async () => {
    const f = fakeSupabase({ responses: { consents: [ok(null), ok({ id: "c-1", version: "2026-10-11" })] } });
    expect(await acceptConsent(f.sb, "2026-10-11")).toMatchObject({ version: "2026-10-11" });
    expect(f.argsOf("upsert")).toEqual([{ user_id: "user-1", version: "2026-10-11" }, { onConflict: "user_id,version", ignoreDuplicates: true }]);
  });

  it("marks an alert seen", async () => {
    const f = fakeSupabase({ responses: { drug_alerts: [ok({ id: "a", seen: true })] } });
    await markAlertSeen(f.sb, "a");
    expect(f.argsOf("update")).toEqual([{ seen: true }]);
  });

  it("reports an AI mistake by changing the status only", async () => {
    const f = fakeSupabase({ responses: { ai_runs: [ok({ id: "r", status: "reported" })] } });
    await reportAiMistake(f.sb, "r", "wrong dose");
    expect(f.argsOf("update")).toEqual([{ status: "reported" }]);
  });

  it("saves a push token once per user and token", async () => {
    const f = fakeSupabase({ responses: { push_tokens: [ok(null)] } });
    await savePushToken(f.sb, "ExponentPushToken[abc]", "android");
    const [row, opts] = f.argsOf("upsert") as [Record<string, unknown>, unknown];
    expect(row).toMatchObject({ user_id: "user-1", token: "ExponentPushToken[abc]", platform: "android" });
    expect(opts).toEqual({ onConflict: "user_id,token" });
  });
});

describe("timeline", () => {
  const sources = {
    prescriptions: [{ id: "rx", issued_on: "2026-10-10", diagnosis: "Type 2 Diabetes", doctor_name: "Dr Mehta", source: "doctor" }],
    reports: [
      { id: "lab", report_date: "2026-10-10", created_at: "2026-10-11T08:00:00Z", lab_name: "Sample Diagnostics", summary: "HbA1c 6.8%" },
      { id: "lab2", report_date: null, created_at: "2026-07-01T08:00:00Z", lab_name: null, summary: null },
    ],
    appointments: [
      { id: "ap", appointment_date: "2026-10-10", token_no: 12, status: "completed", reason: null, hospitals: { name: "AIIMS" }, departments: { name: "Medicine" } },
    ],
    conditions: [{ id: "cond", diagnosed_on: null, created_at: "2026-01-02T00:00:00Z", name: "Hypertension", source: "patient" }],
  };

  it("merges everything newest first and orders a single day by kind", () => {
    const t = buildTimeline(sources);
    expect(t.map((e) => e.id)).toEqual(["ap", "rx", "lab", "lab2", "cond"]);
    expect(t[0]).toMatchObject({ kind: "appointment", title: "Appointment, token 12: Medicine", subtitle: "AIIMS · completed" });
    expect(t[1]).toMatchObject({ title: "Prescription: Type 2 Diabetes", subtitle: "Dr Mehta" });
    expect(t[3]).toMatchObject({ date: "2026-07-01", title: "Lab report" });
    expect(t[4]).toMatchObject({ date: "2026-01-02", subtitle: null });
  });

  it("loads the four sources in parallel for the signed-in patient", async () => {
    const f = fakeSupabase({
      responses: { prescriptions: [ok([])], lab_reports: [ok([])], appointments: [ok([])], conditions: [ok([])] },
    });
    expect(await getTimeline(f.sb)).toEqual([]);
    expect(f.calls.filter((c) => c.name === "from").map((c) => c.args[0])).toEqual(["prescriptions", "lab_reports", "appointments", "conditions"]);
    expect(f.calls.filter((c) => c.name === "eq").every((c) => c.args[1] === "user-1")).toBe(true);
  });
});

describe("storage", () => {
  it("makes version 4 UUIDs", () => {
    const id = randomUuid();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(randomUuid()).not.toBe(id);
  });

  it("uploads into the user's own folder with the right content type", async () => {
    const f = fakeSupabase({ userId: "user-7" });
    const path = await uploadFile(f.sb, "prescriptions", new Blob(["x"]), ".PDF");
    expect(path).toMatch(/^user-7\/[0-9a-f-]{36}\.pdf$/);
    const [bucket, uploaded, , opts] = f.argsOf("storage.upload");
    expect(bucket).toBe("prescriptions");
    expect(uploaded).toBe(path);
    expect(opts).toEqual({ contentType: "application/pdf", upsert: false });
  });

  it("refuses a file type the bucket does not take", async () => {
    const f = fakeSupabase();
    await expect(uploadFile(f.sb, "lab-reports", new Blob(["x"]), "exe")).rejects.toMatchObject({ code: "unsupported_file_type" });
    expect(f.calls).toHaveLength(0);
  });

  it("turns a storage error into a DbError", async () => {
    const f = fakeSupabase({ responses: { "storage.upload": [fail("new row violates row-level security policy")] } });
    await expect(uploadFile(f.sb, "prescriptions", new Blob(["x"]), "png")).rejects.toBeInstanceOf(DbError);
  });

  it("asks for a link that lasts 60 minutes", async () => {
    const f = fakeSupabase();
    expect(await getSignedUrl(f.sb, "lab-reports", "u/a.pdf")).toBe("https://signed.test/u/a.pdf");
    expect(f.argsOf("storage.createSignedUrl")).toEqual(["lab-reports", "u/a.pdf", 3600]);
  });
});

describe("realtime", () => {
  it("names the channel of each live table for one user", () => {
    expect(liveChannelName("appointments", "u1")).toBe("appointments:doctor:u1");
    expect(liveChannelName("drug_alerts", "u1")).toBe("alerts:u1");
    expect(liveChannelName("care_plans", "u1")).toBe("care-plans:u1");
  });

  it("listens to every change of a table and stops on request", () => {
    const f = fakeSupabase();
    const seen: string[] = [];
    const stop = subscribeTable(f.sb, "chan-1", "care_plans", () => seen.push("changed"));
    expect(f.channels[0]).toMatchObject({ name: "chan-1", subscribed: true });
    expect(f.channels[0].handlers[0].filter).toEqual({ event: "*", schema: "public", table: "care_plans" });
    f.emitChange("chan-1");
    expect(seen).toEqual(["changed"]);
    stop();
    expect(f.channels[0].removed).toBe(true);
  });

  it("can narrow a subscription with a filter", () => {
    const f = fakeSupabase();
    subscribeTable(f.sb, "chan-2", "appointments", () => undefined, "patient_id=eq.u1");
    expect(f.channels[0].handlers[0].filter).toMatchObject({ filter: "patient_id=eq.u1" });
  });
});
