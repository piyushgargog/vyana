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
  MedicinesCompareRes,
  PmjayHospitalsRes,
  PrescriptionExtractRes,
  ReportAnalyzeRes,
  ShareRes,
  TriageRes,
} from "../contracts";
import {
  alertsCheckMock,
  basketCompareMock,
  carePlanMock,
  doctorsVerifyMock,
  emergencyNearbyMock,
  emergencySosMock,
  hospitalInfoMock,
  interactionsMock,
  labsCompareMock,
  medicinesCompareMock,
  pmjayHospitalsMock,
  prescriptionsExtractMock,
  reportsAnalyzeMock,
  shareMock,
  triageEmergencyMock,
  triageMock,
} from ".";

const cases: [string, ZodType, unknown][] = [
  ["medicines/compare", MedicinesCompareRes, medicinesCompareMock],
  ["labs/compare", LabsCompareRes, labsCompareMock],
  ["emergency/nearby", EmergencyNearbyRes, emergencyNearbyMock],
  ["emergency/sos", EmergencySosRes, emergencySosMock],
  ["doctors/verify", DoctorVerifyRes, doctorsVerifyMock],
  ["prescriptions/extract", PrescriptionExtractRes, prescriptionsExtractMock],
  ["reports/analyze", ReportAnalyzeRes, reportsAnalyzeMock],
  ["alerts/check", AlertsCheckRes, alertsCheckMock],
  ["prescriptions/basket", BasketCompareRes, basketCompareMock],
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

  it("price quotes are sorted by price with unknown prices last", () => {
    for (const res of [medicinesCompareMock, labsCompareMock]) {
      const prices = res.quotes.map((q) => q.price ?? Number.POSITIVE_INFINITY);
      expect(prices).toEqual([...prices].sort((a, b) => a - b));
      expect(res.cheapest).toEqual(res.quotes[0]);
    }
  });

  it("basket totals, ordering and savings are consistent", () => {
    for (const b of basketCompareMock.baskets) {
      const priced = b.lines.filter((l) => l.line_total !== null);
      expect(b.total).toBe(priced.length ? round(priced.reduce((s, l) => s + (l.line_total ?? 0), 0)) : null);
      for (const l of b.lines) {
        if (l.unit_price !== null) expect(l.line_total).toBe(round(l.unit_price * l.quantity));
      }
      expect(b.status === "partial").toBe(b.missing.length > 0);
    }
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
