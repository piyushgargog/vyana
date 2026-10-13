import { describe, expect, it } from "vitest";
import { frequencyOf, verifyRx, type RxLlm } from "@/lib/server/prescriptions";

/** ADR-058: how often a medicine is taken is decided in code from the written schedule, never by the model. */

describe("frequencyOf", () => {
  it.each([
    ["1-0-1", "BD"],
    ["1-1-1", "TDS"],
    ["1-1-1-1", "QID"],
    ["1-0-0", "OD"],
    ["0-0-1", "OD"],
    ["0-1-0", "OD"],
    ["0-1-1", "BD"],
    ["1-1-0", "BD"],
    ["1 - 0 - 1", "BD"],
    ["1/0/1", "BD"],
    ["1x0x1", "BD"],
    ["1–0–1", "BD"],
    ["Tab Metformin 500 mg 1-0-1 after food", "BD"],
    ["BD", "BD"],
    ["b.d.", "BD"],
    ["twice daily", "BD"],
    ["twice a day after food", "BD"],
    ["TDS", "TDS"],
    ["thrice a day", "TDS"],
    ["three times daily", "TDS"],
    ["QID", "QID"],
    ["four times a day", "QID"],
    ["OD", "OD"],
    ["once daily", "OD"],
    ["once a day at night", "OD"],
    ["SOS max 3 per day", "SOS"],
    ["PRN", "SOS"],
    ["when needed", "SOS"],
    ["HS", "HS"],
    ["at bedtime", "HS"],
  ])("reads %j as %s", (words, expected) => {
    expect(frequencyOf(words)).toBe(expected);
  });

  it("says nothing when the words do not say", () => {
    expect(frequencyOf(null)).toBeNull();
    expect(frequencyOf("")).toBeNull();
    expect(frequencyOf("after food")).toBeNull();
    expect(frequencyOf("500 mg")).toBeNull();
    expect(frequencyOf("30 days")).toBeNull();
    expect(frequencyOf("1-0-1-0-1")).not.toBe("TDS"); // not a morning-noon-night schedule
  });

  it("does not read a strength or a date as a schedule", () => {
    expect(frequencyOf("Dolo 650 mg 10/10/2026")).toBeNull();
    expect(frequencyOf("Telma 40")).toBeNull();
    expect(frequencyOf("5.1.1")).toBeNull();
  });
});

const f = <T>(value: T | null, evidence: string | null) => ({ value, evidence });
const none = <T>() => f<T>(null, null);
const rx = (frequency: ReturnType<typeof f<RxLlm["items"][number]["frequency"]["value"]>>, text: string) => {
  const out: RxLlm = {
    doctor_name: none(),
    diagnosis: none(),
    issued_on: none(),
    items: [
      {
        medicine_name: f("Metformin", "Metformin"),
        strength: none(),
        form: none(),
        dose: none(),
        frequency,
        times: none(),
        with_food: none(),
        duration_days: none(),
        quantity_total: none(),
        instructions: none(),
      },
    ],
  };
  return verifyRx(out, text, {}, "2026-10-13");
};

describe("verifyRx uses the code's reading of the schedule", () => {
  const text = "Tab Metformin 500 mg 1-0-1 after food 30 days";

  it("the live failure: the model said OD for 1-0-1, the code makes it BD and asks the patient to check", () => {
    const res = rx(f("OD", "1-0-1"), text);
    expect(res.items[0].frequency).toBe("BD");
    expect(res.items[0].needs_review).toBe(true);
    expect(res.items[0].times).toEqual(["09:00", "21:00"]); // the BD reminder times, not the OD one
    expect(res.warnings.join(" ")).toContain("how often");
  });

  it("when the model agrees with the written schedule nothing is flagged", () => {
    const res = rx(f("BD", "1-0-1"), text);
    expect(res.items[0].frequency).toBe("BD");
    expect(res.items[0].needs_review).toBe(false);
    expect(res.warnings).toEqual([]);
  });

  it("when the words cannot be read in code, the model's value stays (its evidence is still required)", () => {
    const res = rx(f("OD", "after food"), "Tab Metformin 500 mg after food 30 days");
    expect(res.items[0].frequency).toBe("OD");
    expect(res.items[0].needs_review).toBe(false);
  });

  it("an evidence quote that is not in the document still clears the frequency", () => {
    const res = rx(f("BD", "1-0-1"), "Tab Metformin 500 mg after food");
    expect(res.items[0].frequency).toBe("custom");
    expect(res.items[0].needs_review).toBe(true);
  });
});
