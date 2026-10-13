import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

import {
  AlertsCheckRes,
  BasketCompareReq,
  BasketCompareRes,
  DoctorVerifyRes,
  EmergencyNearbyRes,
  EmergencySosRes,
  GenerateCarePlanRes,
  HospitalInfoRes,
  InteractionsRes,
  LabsCompareRes,
  PmjayHospitalsRes,
  PrescriptionExtractRes,
  ReportAnalyzeRes,
  LabValueCorrectRes,
  ShareRes,
  TriageRes,
} from "../contracts";
import {
  alertsCheckMock,
  basketCompareMock,
  basketJobRunningMock,
  singleMedicineJobMock,
  carePlanMock,
  doctorsVerifyMock,
  emergencyNearbyMock,
  emergencySosMock,
  hospitalInfoMock,
  interactionsMock,
  labsCompareMock,
  pmjayHospitalsMock,
  prescriptionsExtractMock,
  reportsAnalyzeMock,
  labValueCorrectMock,
  shareMock,
  triageEmergencyMock,
  triageMock,
} from ".";

const cases: [string, ZodType, unknown][] = [
  ["labs/compare", LabsCompareRes, labsCompareMock],
  ["emergency/nearby", EmergencyNearbyRes, emergencyNearbyMock],
  ["emergency/sos", EmergencySosRes, emergencySosMock],
  ["doctors/verify", DoctorVerifyRes, doctorsVerifyMock],
  ["prescriptions/extract", PrescriptionExtractRes, prescriptionsExtractMock],
  ["reports/analyze", ReportAnalyzeRes, reportsAnalyzeMock],
  ["reports/values/correct", LabValueCorrectRes, labValueCorrectMock],
  ["alerts/check", AlertsCheckRes, alertsCheckMock],
  ["prescriptions/basket", BasketCompareRes, basketCompareMock],
  ["prescriptions/basket (running)", BasketCompareRes, basketJobRunningMock],
  ["single medicine (one-item basket)", BasketCompareRes, singleMedicineJobMock],
  ["care-plan", GenerateCarePlanRes, carePlanMock],
  ["medicines/interactions", InteractionsRes, interactionsMock],
  ["triage", TriageRes, triageMock],
  ["triage (emergency)", TriageRes, triageEmergencyMock],
  ["hospitals/info", HospitalInfoRes, hospitalInfoMock],
  ["schemes/pmjay-hospitals", PmjayHospitalsRes, pmjayHospitalsMock],
  ["share/[token]", ShareRes, shareMock],
];

const round = (n: number) => Math.round(n * 100) / 100;

describe("mock fixtures", () => {
  it.each(cases)("%s matches its response schema", (_route, schema, mock) => {
    const result = schema.safeParse(mock);
    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
  });

  it("lab quotes: verified prices first, by price; the cheapest is the lowest verified one (ADR-050)", () => {
    for (const res of [labsCompareMock]) {
      const rank = (q: (typeof res.quotes)[number]) => [q.price_verified ? 0 : 1, q.price ?? Number.POSITIVE_INFINITY];
      const ranks = res.quotes.map(rank);
      expect(ranks).toEqual([...ranks].sort((x, y) => x[0] - y[0] || x[1] - y[1]));
      expect(res.cheapest).toEqual(res.quotes.find((q) => q.price_verified));
    }
  });

  it("basket totals, ordering and savings are consistent", () => {
    for (const b of basketCompareMock.baskets) {
      const verified = b.lines.filter((l) => l.price_verified);
      expect(b.total).toBe(verified.length ? round(verified.reduce((s, l) => s + (l.line_total ?? 0), 0)) : null);
      for (const l of b.lines) {
        // Only a price confirmed on the product page gets a line total (plan §2A, ADR-036).
        expect(l.line_total).toBe(l.price_verified && l.unit_price !== null ? round(l.unit_price * l.quantity) : null);
      }
      const unverified = b.lines.some((l) => l.unit_price !== null && !l.price_verified);
      expect(b.status === "partial").toBe(b.missing.length > 0 || unverified);
    }
    expect(basketCompareMock.status).toBe("done");
    expect(basketCompareMock.baskets.some((b) => b.status === "pending")).toBe(false);
    expect(basketJobRunningMock.status).toBe("running");
    expect(basketJobRunningMock.baskets.some((b) => b.status === "pending")).toBe(true);
    const complete = basketCompareMock.baskets.filter((b) => b.status === "ok");
    const totals = complete.map((b) => b.total as number);
    expect(totals).toEqual([...totals].sort((a, b) => a - b));
    expect(basketCompareMock.baskets.slice(0, complete.length)).toEqual(complete);
    expect(basketCompareMock.cheapest_source).toBe(complete[0]?.source);
    expect(basketCompareMock.savings_vs_highest).toBe(round(Math.max(...totals) - Math.min(...totals)));
  });

  it("care plans never mention medicines or doses (plan §2A)", () => {
    const text = JSON.stringify(carePlanMock.plan).toLowerCase();
    expect(text).not.toMatch(/\b\d+\s?(mg|ml|mcg|tablets?)\b/);
  });

  it("the emergency triage result points to Emergency only", () => {
    expect(triageEmergencyMock.urgency).toBe("emergency");
    expect(triageEmergencyMock.departments).toEqual(["Emergency"]);
  });

  it("basket requests need exactly one of prescription_id or items", () => {
    expect(BasketCompareReq.safeParse({ prescription_id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4" }).success).toBe(true);
    expect(BasketCompareReq.safeParse({ items: [{ medicine: "Dolo", strength: "650 mg" }] }).success).toBe(true);
    expect(BasketCompareReq.safeParse({}).success).toBe(false);
    expect(BasketCompareReq.safeParse({ prescription_id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4", items: [{ medicine: "Dolo" }] }).success).toBe(false);
  });
});
