import { describe, expect, it } from "vitest";
import { closestRecord, councilKey, nameOverlap, normalizeRegNo, recordMatches } from "@/lib/server/tinyfish/nmc";

const record = { name: "SNEHA GUPTA", reg_no: "12345", state_council: "Delhi Medical Council", year_of_registration: 2011 };
const claim = { name: "Dr. Sneha Gupta", reg_no: "12345", state_council: "Delhi Medical Council" };

describe("normalizers", () => {
  it("ignore spacing and punctuation in numbers and filler words in council names", () => {
    expect(normalizeRegNo("DMC/12-345")).toBe(normalizeRegNo("dmc 12345"));
    expect(councilKey("Delhi Medical Council")).toBe("delhi");
    expect(councilKey("Medical Council of Delhi")).toBe("delhi");
    expect(councilKey("Maharashtra State Medical Council")).toBe("maharashtra");
  });

  it("name overlap counts initials and ignores titles", () => {
    expect(nameOverlap("Dr. Rajesh Kumar Mehta", "R. K. MEHTA")).toBe(1);
    expect(nameOverlap("Rajesh Mehta", "RAJESH KUMAR MEHTA")).toBeCloseTo(2 / 3);
    expect(nameOverlap("Rahul Verma", "SNEHA GUPTA")).toBe(0);
  });
});

describe("recordMatches", () => {
  it("needs number, council, surname and name together", () => {
    expect(recordMatches(record, claim)).toBe(true);
    expect(recordMatches(record, { ...claim, reg_no: "12346" })).toBe(false);
    expect(recordMatches(record, { ...claim, state_council: "Haryana Medical Council" })).toBe(false);
    expect(recordMatches(record, { ...claim, name: "Dr. Sneha Sharma" })).toBe(false); // surname differs
    expect(recordMatches(record, { ...claim, name: "Dr. Priya Gupta" })).toBe(false); // overlap 0.5
    expect(recordMatches(record, { ...claim, name: "" })).toBe(false);
  });

  it("checks the year only when both sides give one", () => {
    expect(recordMatches(record, { ...claim, year_of_registration: 2011 })).toBe(true);
    expect(recordMatches(record, { ...claim, year_of_registration: 2015 })).toBe(false);
    expect(recordMatches({ ...record, year_of_registration: null }, { ...claim, year_of_registration: 2015 })).toBe(true);
  });
});

describe("closestRecord", () => {
  it("prefers the same number, then the closer name", () => {
    const other = { name: "SNEHA GUPTA", reg_no: "99", state_council: "Delhi Medical Council" };
    const sameNo = { name: "AMIT SHAH", reg_no: "12345", state_council: "Delhi Medical Council" };
    expect(closestRecord([other, sameNo], claim)).toBe(sameNo);
    expect(closestRecord([], claim)).toBeNull();
  });
});

describe("NMC_OUTPUT_SCHEMA", () => {
  it("marks optional fields with nullable: true (TinyFish answers 400 to a type list)", async () => {
    const { NMC_OUTPUT_SCHEMA } = await import("@/lib/server/tinyfish/nmc");
    expect(JSON.stringify(NMC_OUTPUT_SCHEMA)).not.toMatch(/"type":\[/);
  });
});
