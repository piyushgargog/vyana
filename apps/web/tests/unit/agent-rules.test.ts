import { describe, expect, it } from "vitest";
import { labRecheckRule, missedDosePatternRule, refillDueRule } from "@/lib/server/agent/rules";

const BANNED = /\b(safe|dose|mg|ml)\b|\bdiagnos/i;

function item(over: Partial<Parameters<typeof refillDueRule>[0]["item"]> = {}) {
  return {
    id: "item-1",
    medicine_name: "Zentrabol",
    strength: "10 mg",
    dose: "1 tablet",
    times: ["08:00"],
    quantity_total: 10,
    refill_alert_days: 3,
    active: true,
    end_date: null,
    ...over,
  };
}
const taken = (n: number) => Array.from({ length: n }, () => ({ item_id: "item-1", status: "taken" as const }));

describe("refillDueRule", () => {
  it("proposes when days left are within the alert window", () => {
    const d = refillDueRule({ today: "2026-10-22", item: item(), doseLogs: taken(8) });
    expect(d).not.toBeNull();
    expect(d?.kind).toBe("refill_due");
    expect(d?.title).toBe("Zentrabol may need a refill");
    expect(d?.reason).toBe("About 2 days of this medicine are left.");
    expect(d?.payload).toEqual({ item_id: "item-1", days_left: 2 });
    expect(d?.expires_in_days).toBe(7);
  });

  it("says the pack is used up at zero and uses singular for one day", () => {
    expect(refillDueRule({ today: "2026-10-22", item: item(), doseLogs: taken(10) })?.reason).toBe("The pack from your prescription is used up.");
    expect(refillDueRule({ today: "2026-10-22", item: item(), doseLogs: taken(9) })?.reason).toBe("About 1 day of this medicine are left.");
  });

  it("returns null when inactive, not due, or quantity unknown", () => {
    expect(refillDueRule({ today: "2026-10-22", item: item({ active: false }), doseLogs: taken(10) })).toBeNull();
    expect(refillDueRule({ today: "2026-10-22", item: item(), doseLogs: taken(2) })).toBeNull();
    expect(refillDueRule({ today: "2026-10-22", item: item({ quantity_total: null }), doseLogs: [] })).toBeNull();
    expect(refillDueRule({ today: "2026-10-22", item: item({ refill_alert_days: null }), doseLogs: taken(10) })).toBeNull();
  });

  it("boundary: exactly at refill_alert_days is due, one more day is not", () => {
    expect(refillDueRule({ today: "2026-10-22", item: item(), doseLogs: taken(7) })?.payload.days_left).toBe(3);
    expect(refillDueRule({ today: "2026-10-22", item: item(), doseLogs: taken(6) })).toBeNull();
  });

  it("never puts the strength in the title", () => {
    expect(refillDueRule({ today: "2026-10-22", item: item({ strength: null }), doseLogs: taken(8) })?.title).toBe("Zentrabol may need a refill");
  });

  it("dedupe key is the same in one month and differs in another", () => {
    const a = refillDueRule({ today: "2026-10-22", item: item(), doseLogs: taken(8) });
    const b = refillDueRule({ today: "2026-10-22", item: item(), doseLogs: taken(8) });
    const c = refillDueRule({ today: "2026-11-02", item: item(), doseLogs: taken(8) });
    expect(a?.dedupe_key).toBe(b?.dedupe_key);
    expect(a?.dedupe_key).toBe("refill:item-1:2026-10");
    expect(c?.dedupe_key).not.toBe(a?.dedupe_key);
  });

  it("title and reason never use banned words", () => {
    for (const n of [8, 10]) {
      const d = refillDueRule({ today: "2026-10-22", item: item({ strength: "10 mg" }), doseLogs: taken(n) });
      expect(d?.title).not.toMatch(BANNED);
      expect(d?.reason).not.toMatch(BANNED);
    }
  });
});

describe("labRecheckRule", () => {
  const base = { today: "2026-10-22", followUp: { test: "Zedlab panel", every_days: 90 }, lastMeasuredOn: "2026-07-24", reportId: "rep-1" };

  it("proposes when overdue", () => {
    const d = labRecheckRule({ ...base, lastMeasuredOn: "2026-06-01" });
    expect(d?.kind).toBe("lab_recheck");
    expect(d?.title).toBe("Time to repeat your Zedlab panel check");
    expect(d?.payload).toEqual({ test: "Zedlab panel", due_on: "2026-08-30" });
    expect(d?.evidence[0]).toEqual({ table: "lab_reports", id: "rep-1", label: "Last Zedlab panel result" });
    expect(d?.expires_in_days).toBe(14);
  });

  it("is due exactly today and not the day before", () => {
    expect(labRecheckRule(base)?.payload.due_on).toBe("2026-10-22");
    expect(labRecheckRule({ ...base, today: "2026-10-21" })).toBeNull();
  });

  it("returns null when the last date is unknown", () => {
    expect(labRecheckRule({ ...base, lastMeasuredOn: null })).toBeNull();
  });

  it("uses 'unknown' when there is no report id", () => {
    expect(labRecheckRule({ ...base, reportId: null })?.evidence[0].id).toBe("unknown");
  });

  it("rejects an invalid interval", () => {
    for (const every_days of [3, 9999, 6, 731, 30.5]) {
      expect(labRecheckRule({ ...base, followUp: { test: "Zedlab panel", every_days } })).toBeNull();
    }
    expect(labRecheckRule({ ...base, followUp: { test: "Zedlab panel", every_days: 7 }, lastMeasuredOn: "2026-10-15" })).not.toBeNull();
    expect(labRecheckRule({ ...base, followUp: { test: "Zedlab panel", every_days: 730 }, lastMeasuredOn: "2024-10-22" })).not.toBeNull();
  });

  it("dedupe key is stable for the same due date and differs for another", () => {
    const a = labRecheckRule(base);
    const b = labRecheckRule(base);
    const c = labRecheckRule({ ...base, lastMeasuredOn: "2026-06-01" });
    expect(a?.dedupe_key).toBe(b?.dedupe_key);
    expect(a?.dedupe_key).toBe("lab:zedlab panel:2026-10-22");
    expect(c?.dedupe_key).not.toBe(a?.dedupe_key);
  });

  it("title and reason never use banned words", () => {
    const d = labRecheckRule(base);
    expect(d?.title).not.toMatch(BANNED);
    expect(d?.reason).not.toMatch(BANNED);
  });
});

describe("missedDosePatternRule", () => {
  const log = (day: string, status: "taken" | "missed" | "skipped" = "missed") => ({ scheduled_for: `${day}T08:00:00Z`, status });
  const base = { today: "2026-10-22", itemId: "item-9", medicineName: "Quorivex", hasCaregiver: false };

  it("proposes with exactly 3 missed in the window", () => {
    const d = missedDosePatternRule({ ...base, logs: [log("2026-10-16"), log("2026-10-19"), log("2026-10-22")] });
    expect(d?.kind).toBe("missed_dose_pattern");
    expect(d?.title).toBe("A few doses of Quorivex were missed this week");
    expect(d?.reason).toBe("3 doses were marked missed in the last 7 days.");
    expect(d?.dedupe_key).toBe("missed:item-9:2026-10-16");
    expect(d?.expires_in_days).toBe(3);
    expect(d?.payload).toEqual({ item_id: "item-9", missed: 3, suggest: "tell_doctor" });
  });

  it("returns null with exactly 2 missed", () => {
    expect(missedDosePatternRule({ ...base, logs: [log("2026-10-20"), log("2026-10-22")] })).toBeNull();
  });

  it("ignores taken, skipped and days outside the window", () => {
    const logs = [log("2026-10-15"), log("2026-10-23"), log("2026-10-20", "taken"), log("2026-10-21", "skipped"), log("2026-10-16"), log("2026-10-22")];
    expect(missedDosePatternRule({ ...base, logs })).toBeNull();
  });

  it("suggests the caregiver when there is one", () => {
    const d = missedDosePatternRule({ ...base, hasCaregiver: true, logs: [log("2026-10-20"), log("2026-10-21"), log("2026-10-22"), log("2026-10-22")] });
    expect(d?.payload).toEqual({ item_id: "item-9", missed: 4, suggest: "tell_caregiver" });
  });

  it("dedupe key is the same on one day and differs in another week", () => {
    const logs = [log("2026-10-20"), log("2026-10-21"), log("2026-10-22")];
    const a = missedDosePatternRule({ ...base, logs });
    const b = missedDosePatternRule({ ...base, logs });
    const c = missedDosePatternRule({ ...base, today: "2026-10-29", logs: [log("2026-10-27"), log("2026-10-28"), log("2026-10-29")] });
    expect(a?.dedupe_key).toBe(b?.dedupe_key);
    expect(c?.dedupe_key).not.toBe(a?.dedupe_key);
  });

  it("title and reason never use banned words", () => {
    const d = missedDosePatternRule({ ...base, logs: [log("2026-10-20"), log("2026-10-21"), log("2026-10-22")] });
    expect(d?.title).not.toMatch(BANNED);
    expect(d?.reason).not.toMatch(BANNED);
  });
});
