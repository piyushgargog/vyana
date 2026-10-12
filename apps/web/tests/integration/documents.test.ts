import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorBody, PrescriptionExtractRes, ReportAnalyzeRes } from "@vyana/shared";
import { USER_ID, VALID_TOKEN, db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const { POST: extract } = await import("@/app/api/prescriptions/extract/route");
const { POST: analyze } = await import("@/app/api/reports/analyze/route");

const post = (handler: (req: Request, p: undefined) => Promise<Response>, body: unknown) =>
  handler(
    new Request("http://localhost/api", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${VALID_TOKEN}` },
      body: JSON.stringify(body),
    }),
    undefined,
  );

const upload = (bucket: string, path: string, bytes = 1000) => db.storage.set(`${bucket}/${path}`, new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }));

beforeEach(() => {
  vi.stubEnv("TINYFISH_MOCK", "1");
  vi.stubEnv("LLM_MOCK", "1");
  resetDb();
  db.rows.profiles[0].allergies = ["Metformin"];
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/prescriptions/extract", () => {
  const path = `${USER_ID}/rx-1.jpg`;

  it("saves the prescription and its items, with review flags and warnings", async () => {
    upload("prescriptions", path);
    const res = await post(extract, { file_path: path });
    expect(res.status).toBe(200);
    const body = PrescriptionExtractRes.parse(await res.json());

    expect(body.doctor_name).toBe("Dr. Rajesh Mehta");
    expect(body.diagnosis).toBe("Type 2 Diabetes");
    expect(body.issued_on).toBe("2026-10-10");
    expect(body.items.map((i) => [i.medicine_name, i.frequency, i.times, i.needs_review])).toEqual([
      ["Metformin", "BD", ["09:00", "21:00"], true], // the fixture's "1 tablet" dose has no evidence → cleared + review
      ["Telma", "OD", ["21:00"], false],
    ]);
    expect(body.items[0].dose).toBeNull();
    expect(body.warnings).toEqual(
      expect.arrayContaining([
        "Read from a photo: please check every medicine against your paper prescription.",
        "Allergy alert: Metformin may contain Metformin.",
      ]),
    );
    expect(body.ai.model).toBe("mock");

    const saved = db.rows.prescriptions[0];
    expect(saved).toMatchObject({ patient_id: USER_ID, source: "upload", file_path: path });
    expect(db.rows.prescription_items).toHaveLength(2);
    expect(db.rows.prescription_items[0]).toMatchObject({ prescription_id: saved.id, patient_id: USER_ID, active: true, end_date: "2026-11-08" });
    expect(body.items.map((i) => i.id)).toEqual(db.rows.prescription_items.map((r) => r.id));
    expect(db.rows.ai_runs.map((r) => [r.feature, r.status])).toEqual([
      ["rx_transcribe", "ok"],
      ["rx_extract", "needs_review"],
    ]);
  });

  it("removes the prescription when its items can't be saved", async () => {
    upload("prescriptions", path);
    db.failInsert.add("prescription_items");
    const res = await post(extract, { file_path: path });
    expect(res.status).toBe(500);
    expect(db.rows.prescriptions ?? []).toHaveLength(0);
  });

  it("only reads the user's own files of allowed types", async () => {
    expect((await post(extract, { file_path: "someone-else/rx.jpg" })).status).toBe(403);
    expect((await post(extract, { file_path: `${USER_ID}/rx.exe` })).status).toBe(403);
    expect((await post(extract, { file_path: `${USER_ID}/missing.jpg` })).status).toBe(404);
  });

  it("refuses files over 10 MB", async () => {
    upload("prescriptions", path, 10 * 1024 * 1024 + 1);
    expect((await post(extract, { file_path: path })).status).toBe(400);
  });

  it("doesn't send a photo to a model until a provider's data terms are approved", async () => {
    vi.stubEnv("LLM_MOCK", "0");
    upload("prescriptions", path);
    const res = await post(extract, { file_path: path });
    expect(res.status).toBe(502);
    expect(ApiErrorBody.parse(await res.json()).error.message).toContain("isn't available yet");
    expect(db.rows.prescriptions ?? []).toHaveLength(0);
  });

  it("is for patients only", async () => {
    db.rows.profiles[0].role = "doctor";
    expect((await post(extract, { file_path: path })).status).toBe(403);
  });
});

describe("POST /api/reports/analyze", () => {
  const path = `${USER_ID}/report-1.png`;

  it("reads the values, flags them in code and writes a safe summary", async () => {
    upload("lab-reports", path);
    const res = await post(analyze, { file_path: path });
    expect(res.status).toBe(200);
    const body = ReportAnalyzeRes.parse(await res.json());

    expect(body.values.map((v) => [v.test_name, v.value, v.flag])).toEqual([
      ["HbA1c", 7.4, "high"],
      ["Fasting Blood Sugar", 115, "high"],
      ["Haemoglobin", 13.5, "normal"],
    ]);
    expect(body.report_date).toBe("2026-10-05");
    expect(body.follow_up_tests).toEqual(["HbA1c", "Fasting Blood Sugar"]);
    expect(body.summary).toBe("2 of 3 values are outside their reference range: HbA1c, Fasting Blood Sugar. Please discuss these results with your doctor.");

    const report = db.rows.lab_reports[0];
    expect(report).toMatchObject({ id: body.report_id, status: "done", report_date: "2026-10-05", summary: body.summary });
    expect(db.rows.lab_values.map((v) => [v.test_name, v.flag, v.measured_on])).toEqual([
      ["HbA1c", "high", "2026-10-05"],
      ["Fasting Blood Sugar", "high", "2026-10-05"],
      ["Haemoglobin", "normal", "2026-10-05"],
    ]);
  });

  it("marks the report failed when reading isn't possible", async () => {
    vi.stubEnv("LLM_MOCK", "0");
    upload("lab-reports", path);
    const res = await post(analyze, { file_path: path });
    expect(res.status).toBe(502);
    expect(db.rows.lab_reports[0].status).toBe("failed");
  });
});
