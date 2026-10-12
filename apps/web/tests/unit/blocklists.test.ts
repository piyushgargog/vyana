import { describe, expect, it } from "vitest";
import { checkDiagnosisLanguage, findDosePatterns, hasDiagnosisLanguage, hasDosePattern } from "@/lib/server/safety/blocklists";

describe("diagnosis language", () => {
  const diagnoses = [
    "You have diabetes.",
    "You are suffering from hypertension.",
    "These results mean you have anaemia.",
    "Your report indicates that you have a thyroid problem.",
    "This suggests you may have an infection.",
    "You are diabetic.",
    "Aapko sugar ki bimari hai.",
    "aap ko diabetes hai",
    "आपको मधुमेह है",
    "Diagnosis of tuberculosis is likely.",
  ];
  it.each(diagnoses)("flags %j", (text) => {
    expect(hasDiagnosisLanguage(text)).toBe(true);
  });

  it("finds condition names even without a diagnosis sentence", () => {
    expect(checkDiagnosisLanguage("Values like these are seen in diabetes").diseases.map((d) => d.rule)).toEqual(["condition: diabetes"]);
    expect(checkDiagnosisLanguage("Possible heart attack signs").diseases.map((d) => d.rule)).toEqual(["condition: heart attack"]);
  });

  it("allows the care plan's own condition", () => {
    expect(hasDiagnosisLanguage("Living well with Type 2 Diabetes: walk daily.", ["Type 2 Diabetes"])).toBe(false);
    expect(hasDiagnosisLanguage("Living well with Type 2 Diabetes, watch for asthma.", ["Type 2 Diabetes"])).toBe(true);
  });

  const neutral = [
    "Your HbA1c is 7.4%, above the reference range of 4.0 to 5.6.",
    "Please see a General Medicine doctor soon.",
    "Aapko doctor se milna chahiye.",
    "aapko kal subah khali pet test karwana hai",
    "Keep taking your medicines as prescribed.",
    "Discuss these results with your doctor.",
    "This value is higher than normal.",
  ];
  it.each(neutral)("leaves %j alone", (text) => {
    expect(checkDiagnosisLanguage(text)).toEqual({ phrases: [], diseases: [] });
  });

  it("matches whole words only", () => {
    expect(hasDiagnosisLanguage("He paid the strokes of the oar")).toBe(false);
    expect(hasDiagnosisLanguage("cancelled the appointment")).toBe(false);
    expect(hasDiagnosisLanguage("the outing was fun")).toBe(false);
  });
});

describe("dose patterns", () => {
  const doses = [
    "Take 650 mg every 6 hours",
    "take 2 tablets",
    "Metformin 1-0-1",
    "one capsule twice daily",
    "3 times a day after food",
    "Dolo BD after food",
    "din mein do baar lijiye",
    "दिन में दो बार लें",
    "do goli le lo",
    "You can double the dose",
    "2.5 mg at night",
    "5 ml syrup",
    "2 teaspoons of syrup",
  ];
  it.each(doses)("flags %j", (text) => {
    expect(hasDosePattern(text)).toBe(true);
  });

  const notDoses = [
    "Tap SOS to call for help.",
    "Walk for 30 minutes a day.",
    "Your HbA1c is 7.4%.",
    "Eat less than 5 g of salt a day.",
    "Your appointment is on 12-10-2026.",
    "Your fasting sugar is 115 mg/dL, above the range of 70 to 100 mg/dL.",
    "Drink plenty of water.",
    "Ask your doctor before changing any medicine.",
  ];
  it.each(notDoses)("leaves %j alone", (text) => {
    expect(findDosePatterns(text)).toEqual([]);
  });

  it("lets a care plan's diet mention ml and spoons", () => {
    const diet = "Have a glass (200 ml) of low-fat milk and use 2 teaspoons of oil.";
    expect(hasDosePattern(diet)).toBe(true);
    expect(hasDosePattern(diet, { allowMeasures: true })).toBe(false);
    expect(hasDosePattern("Take 500 mg with 200 ml water", { allowMeasures: true })).toBe(true);
  });
});
