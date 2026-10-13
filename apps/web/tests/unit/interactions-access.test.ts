import { describe, expect, it } from "vitest";
import { patientFor } from "@/lib/server/interactions";

const PATIENT = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const DOCTOR = "33333333-3333-4333-8333-333333333333";
const RX = "44444444-4444-4444-8444-444444444444";

// A fake session: `rx` is what RLS lets the caller read; `doctorOf` is what is_doctor_of answers.
function caller(role: "patient" | "doctor" | "admin" | "caregiver", opts: { rx?: { patient_id: string } | null; doctorOf?: string[] } = {}) {
  const sb = {
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: opts.rx ?? null, error: null }) }) }) }),
    rpc: async (_fn: string, args: { p: string }) => ({ data: (opts.doctorOf ?? []).includes(args.p), error: null }),
  };
  const id = role === "patient" ? PATIENT : DOCTOR;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { sb: sb as any, user: { id } as any, profile: { id, role } as any };
}

const status = (p: Promise<unknown>) => p.then(() => 200, (e: { status?: number }) => e.status);

describe("patientFor (who may check interactions)", () => {
  it("a patient checks only their own medicines", async () => {
    expect(await patientFor(caller("patient"), {})).toBe(PATIENT);
    expect(await patientFor(caller("patient"), { prescription_id: RX })).toBe(PATIENT);
    expect(await status(patientFor(caller("patient"), { patient_id: OTHER }))).toBe(403);
  });

  it("a doctor of the patient may check by prescription or by patient", async () => {
    const doc = caller("doctor", { rx: { patient_id: PATIENT }, doctorOf: [PATIENT] });
    expect(await patientFor(doc, { prescription_id: RX })).toBe(PATIENT);
    expect(await patientFor(doc, { patient_id: PATIENT })).toBe(PATIENT);
  });

  it("another doctor gets 403", async () => {
    expect(await status(patientFor(caller("doctor", { doctorOf: [] }), { patient_id: PATIENT }))).toBe(403);
    expect(await status(patientFor(caller("doctor", { rx: null, doctorOf: [] }), { prescription_id: RX }))).toBe(403);
  });

  it("a doctor must name the patient, and both fields must agree", async () => {
    expect(await status(patientFor(caller("doctor", { doctorOf: [PATIENT] }), {}))).toBe(400);
    const doc = caller("doctor", { rx: { patient_id: PATIENT }, doctorOf: [PATIENT, OTHER] });
    expect(await status(patientFor(doc, { prescription_id: RX, patient_id: OTHER }))).toBe(403);
  });

  it("admins and caregivers get 403", async () => {
    expect(await status(patientFor(caller("admin"), { patient_id: PATIENT }))).toBe(403);
    expect(await status(patientFor(caller("caregiver"), { patient_id: PATIENT }))).toBe(403);
  });
});
