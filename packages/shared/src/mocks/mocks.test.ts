import { describe, expect, it } from "vitest";
import type { ZodType } from "zod";

import {
  BloodSearchRes,
  DoctorVerifyRes,
  EmergencyNearbyRes,
  EmergencySosRes,
  GenerateCarePlanRes,
  InteractionsRes,
  PrescriptionExtractRes,
  ReportAnalyzeRes,
  LabValueCorrectRes,
  ShareRes,
  TriageRes,
} from "../contracts";
import {
  bloodJobRunningMock,
  bloodSearchMock,
  shareMemoryMock,
  carePlanMock,
  doctorsVerifyMock,
  emergencyNearbyMock,
  emergencySosMock,
  interactionsMock,
  prescriptionsExtractMock,
  reportsAnalyzeMock,
  labValueCorrectMock,
  shareMock,
  triageEmergencyMock,
  triageMock,
} from ".";

const cases: [string, ZodType, unknown][] = [
  ["emergency/nearby", EmergencyNearbyRes, emergencyNearbyMock],
  ["emergency/sos", EmergencySosRes, emergencySosMock],
  ["doctors/verify", DoctorVerifyRes, doctorsVerifyMock],
  ["prescriptions/extract", PrescriptionExtractRes, prescriptionsExtractMock],
  ["reports/analyze", ReportAnalyzeRes, reportsAnalyzeMock],
  ["reports/values/correct", LabValueCorrectRes, labValueCorrectMock],
  ["care-plan", GenerateCarePlanRes, carePlanMock],
  ["medicines/interactions", InteractionsRes, interactionsMock],
  ["triage", TriageRes, triageMock],
  ["triage (emergency)", TriageRes, triageEmergencyMock],
  ["share/[token]", ShareRes, shareMock],
  ["share/[token] (memory)", ShareRes, shareMemoryMock],
  ["blood/search", BloodSearchRes, bloodSearchMock],
  ["blood/search (running)", BloodSearchRes, bloodJobRunningMock],
];

describe("mock fixtures", () => {
  it.each(cases)("%s matches its response schema", (_route, schema, mock) => {
    const result = schema.safeParse(mock);
    expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
  });

  it("care plans never mention medicines or doses (plan §2A)", () => {
    const text = JSON.stringify(carePlanMock.plan).toLowerCase();
    expect(text).not.toMatch(/\b\d+\s?(mg|ml|mcg|tablets?)\b/);
  });

  it("the emergency triage result points to Emergency only", () => {
    expect(triageEmergencyMock.urgency).toBe("emergency");
    expect(triageEmergencyMock.departments).toEqual(["Emergency"]);
  });

});
