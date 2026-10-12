import { describe, expect, it } from "vitest";

import {
  addDays,
  atLocalTime,
  daysBetween,
  findLastDone,
  formatLocalDate,
  getRefillStatus,
  MAX_DOSE_REMINDERS,
  nextOccurrenceOfHour,
  parseDoseUnits,
  parseLocalDate,
  planDoseReminders,
  planFollowUpReminders,
  planRefillAlerts,
  sortPlanned,
  type DoseReminderItem,
  type RefillItem,
} from "./index";

// All dates are local, so the tests do not depend on the time zone of the machine.
const at = (day: number, hh: number, mm = 0) => new Date(2026, 9, day, hh, mm);

describe("dates", () => {
  it("adds days across month ends and counts calendar days", () => {
    expect(addDays("2026-10-30", 3)).toBe("2026-11-02");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-10-12", "2026-10-15")).toBe(3);
    expect(daysBetween("2026-10-15", "2026-10-12")).toBe(-3);
    expect(formatLocalDate(parseLocalDate("2026-01-05"))).toBe("2026-01-05");
    expect(atLocalTime("2026-10-12", "21:30").getHours()).toBe(21);
  });
});

describe("parseDoseUnits", () => {
  it("reads the number at the start of the dose", () => {
    expect(parseDoseUnits("1 tablet")).toBe(1);
    expect(parseDoseUnits("2 tablets")).toBe(2);
    expect(parseDoseUnits("5 ml")).toBe(5);
    expect(parseDoseUnits("0.5 tablet")).toBe(0.5);
    expect(parseDoseUnits("1/2 tablet")).toBe(0.5);
    expect(parseDoseUnits(" 2 puffs")).toBe(2);
  });

  it("counts a strength as 1, not as the number of units", () => {
    expect(parseDoseUnits("500 mg")).toBe(1);
    expect(parseDoseUnits("650mg")).toBe(1);
    expect(parseDoseUnits("40 mg OD")).toBe(1);
    expect(parseDoseUnits("0.25 mg")).toBe(1);
    expect(parseDoseUnits("500 mcg")).toBe(1);
    expect(parseDoseUnits("2 g")).toBe(1);
    expect(parseDoseUnits("10 IU")).toBe(1);
    expect(parseDoseUnits("5%")).toBe(1);
    expect(parseDoseUnits("1/2 mg")).toBe(1);
  });

  it("counts the number before a countable unit, with or without a space", () => {
    expect(parseDoseUnits("2 tablets")).toBe(2);
    expect(parseDoseUnits("2tab")).toBe(2);
    expect(parseDoseUnits("1 Capsule")).toBe(1);
    expect(parseDoseUnits("5ml")).toBe(5);
    expect(parseDoseUnits("10 ML")).toBe(10);
    expect(parseDoseUnits("2 puffs")).toBe(2);
    expect(parseDoseUnits("3 drops")).toBe(3);
    expect(parseDoseUnits("1 sachet")).toBe(1);
    expect(parseDoseUnits("2 tsp")).toBe(2);
    expect(parseDoseUnits("2 goli")).toBe(2);
    expect(parseDoseUnits("1 tablet (500 mg)")).toBe(1);
    expect(parseDoseUnits("2")).toBe(2);
  });

  it("counts a dose it cannot read as 1", () => {
    expect(parseDoseUnits(null)).toBe(1);
    expect(parseDoseUnits("")).toBe(1);
    expect(parseDoseUnits("as directed")).toBe(1);
    expect(parseDoseUnits("0 tablets")).toBe(1);
    expect(parseDoseUnits("1/0 tablet")).toBe(1);
  });
});

describe("getRefillStatus", () => {
  const metformin: RefillItem = {
    id: "i-1",
    dose: "1 tablet",
    times: ["09:00", "21:00"],
    quantity_total: 30,
    refill_alert_days: 3,
    active: true,
    end_date: null,
  };
  const taken = (n: number, id = "i-1") => Array.from({ length: n }, () => ({ item_id: id, status: "taken" as const }));
  const today = at(12, 12);

  it("subtracts the taken doses and divides by the daily use", () => {
    expect(getRefillStatus(metformin, taken(10), today)).toEqual({ units_left: 20, days_left: 10, refill_due: false });
  });

  it("is due when the days left are within the alert days", () => {
    expect(getRefillStatus(metformin, taken(24), today)).toEqual({ units_left: 6, days_left: 3, refill_due: true });
    expect(getRefillStatus(metformin, taken(23), today)).toEqual({ units_left: 7, days_left: 3, refill_due: true });
    expect(getRefillStatus(metformin, taken(22), today)).toEqual({ units_left: 8, days_left: 4, refill_due: false });
  });

  it("counts only taken doses of this medicine", () => {
    const logs = [...taken(2), { item_id: "i-1", status: "missed" as const }, { item_id: "i-1", status: "skipped" as const }, ...taken(9, "other")];
    expect(getRefillStatus(metformin, logs, today).units_left).toBe(28);
  });

  it("uses the units per dose", () => {
    const syrup: RefillItem = { ...metformin, dose: "5 ml", times: ["08:00", "20:00"], quantity_total: 100 };
    expect(getRefillStatus(syrup, taken(6), today)).toEqual({ units_left: 70, days_left: 7, refill_due: false });
    const half: RefillItem = { ...metformin, dose: "1/2 tablet", times: ["09:00"], quantity_total: 10 };
    expect(getRefillStatus(half, taken(4), today)).toEqual({ units_left: 8, days_left: 16, refill_due: false });
  });

  it("is due and empty when everything was taken", () => {
    expect(getRefillStatus(metformin, taken(40), today)).toEqual({ units_left: 0, days_left: 0, refill_due: true });
  });

  it("knows nothing without the quantity dispensed", () => {
    expect(getRefillStatus({ ...metformin, quantity_total: null }, taken(5), today)).toEqual({ units_left: null, days_left: null, refill_due: false });
  });

  it("has no days left for an as-needed medicine, but is due when it is used up", () => {
    const dolo: RefillItem = { ...metformin, times: [], quantity_total: 10 };
    expect(getRefillStatus(dolo, taken(4), today)).toEqual({ units_left: 6, days_left: null, refill_due: false });
    expect(getRefillStatus(dolo, taken(10), today)).toEqual({ units_left: 0, days_left: null, refill_due: true });
  });

  it("does not ask to reorder a medicine that is switched off or whose course is over", () => {
    expect(getRefillStatus({ ...metformin, active: false }, taken(28), today).refill_due).toBe(false);
    expect(getRefillStatus({ ...metformin, end_date: "2026-10-10" }, taken(28), today).refill_due).toBe(false);
  });

  it("does not ask to reorder when the course ends before the pack would run out", () => {
    // 2 days left in the pack, the course ends in 1 day
    const finishing: RefillItem = { ...metformin, quantity_total: 8, end_date: "2026-10-13" };
    expect(getRefillStatus(finishing, taken(4), today)).toMatchObject({ days_left: 2, refill_due: false });
    // the same pack with the course running on is due
    expect(getRefillStatus({ ...finishing, end_date: "2026-11-30" }, taken(4), today).refill_due).toBe(true);
  });

  it("does not read a strength as a count (500 mg, 60 tablets, one dose taken)", () => {
    const strengthAsDose: RefillItem = { ...metformin, dose: "500 mg", times: ["09:00", "21:00"], quantity_total: 60 };
    expect(getRefillStatus(strengthAsDose, taken(1), today)).toEqual({ units_left: 59, days_left: 29, refill_due: false });
  });

  it("is due 2 days before running out, like the demo patient", () => {
    const demo: RefillItem = { ...metformin, quantity_total: 34 };
    expect(getRefillStatus(demo, taken(30), today)).toEqual({ units_left: 4, days_left: 2, refill_due: true });
  });
});

describe("planDoseReminders", () => {
  const bd: DoseReminderItem = {
    id: "i-1",
    medicine_name: "Metformin",
    strength: "500 mg",
    dose: "1 tablet",
    times: ["09:00", "21:00"],
    with_food: "after",
    start_date: "2026-10-01",
    end_date: null,
    active: true,
  };

  it("plans the doses still to come, nearest first, with a stable id", () => {
    const plan = planDoseReminders([bd], [], at(12, 10), { horizonDays: 1 });
    expect(plan.map((p) => p.id)).toEqual(["dose:i-1:2026-10-12T21:00", "dose:i-1:2026-10-13T09:00", "dose:i-1:2026-10-13T21:00"]);
    expect(plan[0]).toMatchObject({ kind: "dose", title: "Time for your medicine", body: "Your 21:00 dose is due. Tap to log it." });
    expect(plan[0].at.getTime()).toBe(at(12, 21).getTime());
    expect(plan[0].data).toMatchObject({ kind: "dose", item_id: "i-1" });
  });

  it("keeps the medicine name off the notification text unless asked, and still carries the id", () => {
    const [hidden] = planDoseReminders([bd], [], at(12, 10), { horizonDays: 0 });
    expect(`${hidden.title} ${hidden.body}`).not.toMatch(/Metformin|500 mg|tablet/);
    expect(hidden.data.item_id).toBe("i-1");
    const [shown] = planDoseReminders([bd], [], at(12, 10), { horizonDays: 0, showNames: true });
    expect(shown.body).toBe("Metformin 500 mg · 1 tablet · after food");
  });

  it("leaves out doses already logged as taken or skipped, but not missed ones", () => {
    const logs = [
      { item_id: "i-1", scheduled_for: at(12, 21, 5).toISOString(), status: "taken" as const },
      { item_id: "i-1", scheduled_for: at(13, 9).toISOString(), status: "skipped" as const },
      { item_id: "i-1", scheduled_for: at(13, 21).toISOString(), status: "missed" as const },
    ];
    const ids = planDoseReminders([bd], logs, at(12, 10), { horizonDays: 1 }).map((p) => p.id);
    expect(ids).toEqual(["dose:i-1:2026-10-13T21:00"]);
  });

  it("respects the start date, the end date, switched-off and as-needed medicines", () => {
    const now = at(12, 10);
    expect(planDoseReminders([{ ...bd, start_date: "2026-10-14" }], [], now, { horizonDays: 2 }).map((p) => p.id)[0]).toBe("dose:i-1:2026-10-14T09:00");
    expect(planDoseReminders([{ ...bd, end_date: "2026-10-12" }], [], now, { horizonDays: 5 })).toHaveLength(1);
    expect(planDoseReminders([{ ...bd, active: false }], [], now)).toHaveLength(0);
    expect(planDoseReminders([{ ...bd, times: [] }], [], now)).toHaveLength(0);
  });

  it("does not remind of a time that has passed or is within 5 seconds", () => {
    expect(planDoseReminders([bd], [], at(12, 21)).map((p) => p.id)[0]).toBe("dose:i-1:2026-10-13T09:00");
  });

  it("caps the list so iOS keeps room for the other reminders", () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ ...bd, id: `i-${i}`, times: ["08:00", "12:00", "16:00", "20:00"] }));
    const plan = planDoseReminders(many, [], at(12, 7));
    expect(plan).toHaveLength(MAX_DOSE_REMINDERS);
    expect(plan.map((p) => p.at.getTime())).toEqual([...plan.map((p) => p.at.getTime())].sort((a, b) => a - b));
  });
});

describe("planRefillAlerts", () => {
  const item = {
    id: "i-1",
    medicine_name: "Metformin",
    strength: "500 mg",
    dose: "1 tablet",
    times: ["09:00", "21:00"],
    quantity_total: 34,
    refill_alert_days: 3,
    active: true,
    end_date: null,
  };
  const taken = Array.from({ length: 30 }, () => ({ item_id: "i-1", status: "taken" as const }));

  it("alerts at 9:00 for a medicine that is due, naming the days left", () => {
    const [alert] = planRefillAlerts([item], taken, at(12, 12));
    expect(alert).toMatchObject({ id: "refill:i-1:2026-10-13", kind: "refill", title: "Time to reorder" });
    expect(alert.body).toBe("A medicine is running low. Tap to see which and order it again.");
    expect(planRefillAlerts([item], taken, at(12, 12), { showNames: true })[0].body).toBe("Metformin 500 mg: 2 days left. Tap to order it again.");
    expect(alert.at.getTime()).toBe(at(13, 9).getTime());
    expect(alert.data).toEqual({ kind: "refill", item_id: "i-1" });
  });

  it("alerts the same morning when it is still before 9:00", () => {
    expect(planRefillAlerts([item], taken, at(12, 7))[0].at.getTime()).toBe(at(12, 9).getTime());
  });

  it("says when it runs out today and when it is low", () => {
    const empty = Array.from({ length: 34 }, () => ({ item_id: "i-1", status: "taken" as const }));
    expect(planRefillAlerts([item], empty, at(12, 12), { showNames: true })[0].body).toContain("runs out today");
    const asNeeded = { ...item, times: [], quantity_total: 10 };
    const used = Array.from({ length: 10 }, () => ({ item_id: "i-1", status: "taken" as const }));
    expect(planRefillAlerts([asNeeded], used, at(12, 12), { showNames: true })[0].body).toContain("runs out today");
  });

  it("stays quiet for a medicine that is not due", () => {
    expect(planRefillAlerts([item], [], at(12, 12))).toEqual([]);
  });
});

describe("planFollowUpReminders", () => {
  const tests = [
    { test: "HbA1c", every_days: 90 },
    { test: "Lipid profile", every_days: 180 },
  ];

  it("is due every_days after the last measurement", () => {
    const plan = planFollowUpReminders("cp-1", tests, { hba1c: "2026-08-01" }, "2026-09-01", at(12, 12));
    const hba1c = plan.find((p) => p.id === "followup:cp-1:hba1c");
    expect(hba1c?.at.getTime()).toBe(at(30, 10).getTime()); // 2026-08-01 + 90 days = 2026-10-30
    expect(hba1c).toMatchObject({ kind: "follow_up", title: "Time for a check-up test" });
    expect(hba1c?.body).toBe("A check-up test from your care plan is due."); // no test name on a lock screen
    expect(planFollowUpReminders("cp-1", tests, {}, "2026-09-01", at(12, 12), { showNames: true })[0].body).toContain("is due");
    expect(hba1c?.data).toEqual({ kind: "follow_up", plan_id: "cp-1", test: "HbA1c" });
  });

  it("counts from the approval date when the test was never done", () => {
    const plan = planFollowUpReminders("cp-1", tests, {}, "2026-10-01", at(12, 12));
    expect(plan.find((p) => p.id === "followup:cp-1:lipid profile")?.at.getTime()).toBe(parseLocalDate(addDays("2026-10-01", 180)).setHours(10, 0, 0, 0));
  });

  it("reminds at the next 10:00 when the test is overdue", () => {
    const plan = planFollowUpReminders("cp-1", tests, { hba1c: "2026-01-01" }, "2026-01-01", at(12, 12));
    expect(plan.find((p) => p.id === "followup:cp-1:hba1c")?.at.getTime()).toBe(at(13, 10).getTime());
    const early = planFollowUpReminders("cp-1", tests, { hba1c: "2026-01-01" }, "2026-01-01", at(12, 8));
    expect(early.find((p) => p.id === "followup:cp-1:hba1c")?.at.getTime()).toBe(at(12, 10).getTime());
  });

  it("matches test names ignoring case and spaces, and skips a bad interval", () => {
    const plan = planFollowUpReminders("cp-1", [{ test: " hbA1C ", every_days: 30 }, { test: "x", every_days: 0 }], { hba1c: "2026-10-01" }, "2026-01-01", at(12, 12));
    expect(plan).toHaveLength(1);
    expect(plan[0].at.getTime()).toBe(at(31, 10).getTime());
  });
});

describe("findLastDone", () => {
  it("matches the short name of the plan to the long name of the lab", () => {
    const lastDone = { "glycated haemoglobin (hba1c)": "2026-08-01", "lipid profile - total cholesterol": "2026-07-01" };
    expect(findLastDone("HbA1c", lastDone)).toBe("2026-08-01");
    expect(findLastDone("Hb A1c", lastDone)).toBe("2026-08-01");
    expect(findLastDone("Total cholesterol", lastDone)).toBe("2026-07-01");
  });

  it("takes the latest date when several names match, and none when nothing does", () => {
    const lastDone = { hba1c: "2026-05-01", "glycated haemoglobin (hba1c)": "2026-08-01" };
    expect(findLastDone("hba1c", lastDone)).toBe("2026-08-01");
    expect(findLastDone("Vitamin D", lastDone)).toBeNull();
  });

  it("does not match on very short names", () => {
    expect(findLastDone("T3", { "free t3 hormone": "2026-08-01", t3: "2026-01-01" })).toBe("2026-01-01");
    expect(findLastDone("Fe", { ferritin: "2026-08-01" })).toBeNull();
  });

  it("is used by the follow-up reminders", () => {
    const plan = planFollowUpReminders("cp-1", [{ test: "HbA1c", every_days: 90 }], { "glycated haemoglobin (hba1c)": "2026-08-01" }, "2026-01-01", at(12, 12));
    expect(plan[0].at.getTime()).toBe(at(30, 10).getTime()); // 2026-08-01 + 90 days, not 2026-01-01 + 90
  });
});

describe("helpers", () => {
  it("finds the next occurrence of an hour and merges lists by time", () => {
    expect(nextOccurrenceOfHour(at(12, 8), 9).getTime()).toBe(at(12, 9).getTime());
    expect(nextOccurrenceOfHour(at(12, 9), 9).getTime()).toBe(at(13, 9).getTime());
    const a = { id: "a", kind: "dose" as const, at: at(12, 20), title: "", body: "", data: {} };
    const b = { id: "b", kind: "refill" as const, at: at(12, 9), title: "", body: "", data: {} };
    expect(sortPlanned([a], [b]).map((p) => p.id)).toEqual(["b", "a"]);
  });
});
