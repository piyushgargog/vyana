import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

import {
  AlertsCheckRes,
  DoctorVerifyRes,
  EmergencyNearbyRes,
  EmergencySosRes,
  LabsCompareRes,
  MedicinesCompareRes,
  NutritionPlanRes,
  PrescriptionExtractRes,
  ReportAnalyzeRes,
} from "../contracts";
import {
  alertsCheckMock,
  doctorsVerifyMock,
  emergencyNearbyMock,
  emergencySosMock,
  labsCompareMock,
  medicinesCompareMock,
  nutritionPlanMock,
  prescriptionsExtractMock,
  reportsAnalyzeMock,
} from ".";

const cases: [string, ZodType, unknown][] = [
  ["medicines/compare", MedicinesCompareRes, medicinesCompareMock],
  ["labs/compare", LabsCompareRes, labsCompareMock],
  ["emergency/nearby", EmergencyNearbyRes, emergencyNearbyMock],
  ["emergency/sos", EmergencySosRes, emergencySosMock],
  ["doctors/verify", DoctorVerifyRes, doctorsVerifyMock],
  ["prescriptions/extract", PrescriptionExtractRes, prescriptionsExtractMock],
  ["reports/analyze", ReportAnalyzeRes, reportsAnalyzeMock],
  ["nutrition/plan", NutritionPlanRes, nutritionPlanMock],
  ["alerts/check", AlertsCheckRes, alertsCheckMock],
];

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
});
