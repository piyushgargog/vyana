// packages/shared/src/health/adherence.test.ts
// PDC (issue #495): perfect, none, gaps, overlap, mid-window start, IST day edges.
// Owner: Vaibhav Parmar

import { describe, expect, it } from "vitest";

import { computePdc, isAdherent, type PdcItem, type PdcLog } from "./adherence";

const item = (id: string, start: string, end: string | null = null): PdcItem => ({ id, start_date: start, end_date: end });
/** A taken log at 08:00 IST on the given date (02:30 UTC). */
const taken = (item_id: string, date: string): PdcLog => ({ item_id, scheduled_for: `${date}T02:30:00.000Z`, status: "taken" });
const takenDays = (item_id: string, dates: string[]): PdcLog[] => dates.map((d) => taken(item_id, d));

const OCT = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10"];

describe("computePdc (#495)", () => {
  it("perfect adherence: every day taken is 100%", () => {
    const r = computePdc([item("a", "2026-10-01")], takenDays("a", OCT), "2026-10-01", "2026-10-10");
    expect(r.perMedicine[0]).toMatchObject({ covered: 10, days: 10, pdc: 100, enough_data: true });
    expect(r.overall).toMatchObject({ covered: 10, days: 10, pdc: 100 });
    expect(isAdherent(r.overall)).toBe(true);
  });

  it("nothing taken is 0%, and missed or skipped logs never cover a day", () => {
    const logs: PdcLog[] = [
      { item_id: "a", scheduled_for: "2026-10-01T02:30:00.000Z", status: "missed" },
      { item_id: "a", scheduled_for: "2026-10-02T02:30:00.000Z", status: "skipped" },
    ];
    const r = computePdc([item("a", "2026-10-01")], logs, "2026-10-01", "2026-10-10");
    expect(r.perMedicine[0]).toMatchObject({ covered: 0, days: 10, pdc: 0 });
  });

  it("gaps: 7 of 10 days is 70%, under the 80% line", () => {
    const r = computePdc([item("a", "2026-10-01")], takenDays("a", OCT.slice(0, 7)), "2026-10-01", "2026-10-10");
    expect(r.perMedicine[0]).toMatchObject({ covered: 7, days: 10, pdc: 70 });
    expect(isAdherent(r.perMedicine[0])).toBe(false);
  });

  it("two doses on one day still cover one day (intervals merge)", () => {
    const logs = [...takenDays("a", OCT), taken("a", "2026-10-01"), taken("a", "2026-10-01")];
    const r = computePdc([item("a", "2026-10-01")], logs, "2026-10-01", "2026-10-10");
    expect(r.perMedicine[0]).toMatchObject({ covered: 10, days: 10, pdc: 100 });
  });

  it("overlapping prescriptions: overall days are the union, not the sum", () => {
    const items = [item("a", "2026-10-01", "2026-10-10"), item("b", "2026-10-05", "2026-10-14")];
    const logs = [...takenDays("a", OCT), ...takenDays("b", ["2026-10-11", "2026-10-12", "2026-10-13", "2026-10-14"])];
    const r = computePdc(items, logs, "2026-10-01", "2026-10-14");
    // a covers 1-10, b covers 11-14 (taken) of its 5-14; union of active days is 1-14 = 14, covered 14.
    expect(r.perMedicine[1]).toMatchObject({ covered: 4, days: 10, pdc: 40 });
    expect(r.overall).toMatchObject({ covered: 14, days: 14, pdc: 100 });
  });

  it("a medicine started mid-window counts only its own days", () => {
    const r = computePdc([item("a", "2026-10-08")], takenDays("a", ["2026-10-08", "2026-10-09", "2026-10-10"]), "2026-10-01", "2026-10-10");
    expect(r.perMedicine[0]).toMatchObject({ covered: 3, days: 3, pdc: 100, enough_data: false });
  });

  it("logs outside the prescription range cover nothing and days outside do not count", () => {
    const logs = [...takenDays("a", ["2026-09-30", "2026-10-11"]), ...takenDays("a", OCT.slice(0, 5))];
    const r = computePdc([item("a", "2026-10-01", "2026-10-10")], logs, "2026-09-01", "2026-10-31");
    expect(r.perMedicine[0]).toMatchObject({ covered: 5, days: 10, pdc: 50 });
  });

  it("fewer than 7 observed days is not enough data, however good the percentage", () => {
    const r = computePdc([item("a", "2026-10-05")], takenDays("a", ["2026-10-05", "2026-10-06"]), "2026-10-05", "2026-10-10");
    expect(r.perMedicine[0]).toMatchObject({ days: 6, pdc: 33, enough_data: false });
    expect(isAdherent(r.perMedicine[0])).toBe(false);
  });

  it("IST boundary: a dose logged at 00:30 IST belongs to that IST day, not the UTC day before", () => {
    // 2026-10-01 00:30 IST is 2026-09-30 19:00 UTC. The prescription starts 1 Oct IST.
    const logs: PdcLog[] = [{ item_id: "a", scheduled_for: "2026-09-30T19:00:00.000Z", status: "taken" }];
    const r = computePdc([item("a", "2026-10-01", "2026-10-01")], logs, "2026-10-01", "2026-10-01");
    expect(r.perMedicine[0]).toMatchObject({ covered: 1, days: 1 });
  });

  it("no medicines in the window: zeroes, not a crash", () => {
    const r = computePdc([item("a", "2026-11-01")], [], "2026-10-01", "2026-10-10");
    expect(r.perMedicine[0]).toMatchObject({ covered: 0, days: 0, pdc: 0, enough_data: false });
    expect(r.overall).toMatchObject({ covered: 0, days: 0, pdc: 0 });
  });
});
