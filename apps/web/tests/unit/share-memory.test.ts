import { describe, expect, it } from "vitest";
import { mocks } from "@vyana/shared";
import {
  adherenceDayState,
  adherenceTotals,
  expiryCountdown,
  flagText,
  formatChartDate,
  formatShareDate,
  medicineScale,
  vitalTitle,
} from "@/components/share/share-utils";

// The pure helpers behind the Memory Graph sections of the share page (issue #238).
// The fixture is the C0 mock: the same record the page is built against.

const memory = mocks.shareMemoryMock.memory;
if (!memory) throw new Error("the memory mock must carry a memory");

describe("date formatting", () => {
  it("writes an India calendar date as stored, never shifted", () => {
    expect(formatShareDate("2026-01-12")).toBe("12 Jan 2026");
    expect(formatShareDate("2026-10-08")).toBe("8 Oct 2026");
    expect(formatChartDate("2026-01-12")).toBe("12 Jan");
  });

  it("passes a malformed date through untouched rather than inventing one", () => {
    expect(formatShareDate("not-a-date")).toBe("not-a-date");
  });
});

describe("expiryCountdown", () => {
  const expires = "2026-10-13T09:00:00.000Z";

  it("reads days and hours for a long-lived link", () => {
    expect(expiryCountdown(expires, new Date("2026-10-10T05:00:00.000Z"))).toEqual({
      expired: false,
      text: "Expires in 3 d 4 h",
    });
  });

  it("reads hours and minutes inside a day", () => {
    expect(expiryCountdown(expires, new Date("2026-10-13T03:48:00.000Z"))).toEqual({
      expired: false,
      text: "Expires in 5 h 12 min",
    });
  });

  it("reads minutes inside the last hour", () => {
    expect(expiryCountdown(expires, new Date("2026-10-13T08:18:00.000Z"))).toEqual({
      expired: false,
      text: "Expires in 42 min",
    });
  });

  it("is expired at and past the deadline", () => {
    expect(expiryCountdown(expires, new Date("2026-10-13T09:00:00.000Z")).expired).toBe(true);
    expect(expiryCountdown(expires, new Date("2026-10-14T09:00:00.000Z"))).toEqual({
      expired: true,
      text: "Expired",
    });
  });
});

describe("adherence", () => {
  it("never paints a day with a missed dose as taken", () => {
    expect(adherenceDayState({ taken: 2, missed: 1, skipped: 0 })).toBe("missed");
    expect(adherenceDayState({ taken: 3, missed: 0, skipped: 0 })).toBe("taken");
    expect(adherenceDayState({ taken: 0, missed: 0, skipped: 2 })).toBe("skipped");
    expect(adherenceDayState({ taken: 0, missed: 0, skipped: 0 })).toBe("none");
  });

  it("totals are plain sums of the mock's days", () => {
    const days = memory.adherence?.days ?? [];
    expect(adherenceTotals(days)).toEqual({ taken: 8, missed: 1, skipped: 0 });
    expect(memory.adherence?.percent_taken).toBe(89);
  });
});

describe("medicineScale", () => {
  it("spans the mock's courses, the ongoing one running to today", () => {
    const scale = medicineScale(memory.medicines ?? [], "2026-10-13");
    expect(scale).not.toBeNull();
    expect(new Date(scale!.startMs).toISOString().slice(0, 10)).toBe("2022-01-15");
    expect(new Date(scale!.endMs).toISOString().slice(0, 10)).toBe("2026-10-13");
  });

  it("is null with no medicines, and a single-day course still has a span", () => {
    expect(medicineScale([], "2026-10-13")).toBeNull();
    const one = medicineScale([{ start: "2026-10-10", end: "2026-10-10" }], "2026-10-13");
    expect(one!.endMs - one!.startMs).toBe(24 * 60 * 60 * 1000);
  });
});

describe("labels", () => {
  it("writes vital types and lab flags as the page shows them", () => {
    expect(vitalTitle("blood_pressure")).toBe("Blood pressure");
    expect(vitalTitle("spo2")).toBe("Spo2");
    expect(flagText("high")).toBe("High");
    expect(flagText("low")).toBe("Low");
    expect(flagText("normal")).toBe("Normal");
    expect(flagText("unknown")).toBe("");
  });
});
