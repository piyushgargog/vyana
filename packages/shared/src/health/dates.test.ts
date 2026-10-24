import { describe, expect, it } from "vitest";

import { istDayOf, istInstant, istTime } from "./dates";

// India time is computed in UTC, so these tests do not depend on the time zone of the machine.

describe("istInstant and istTime", () => {
  it("turns an India wall-clock time into the right UTC moment and back", () => {
    expect(istInstant("2026-10-12", "09:00").toISOString()).toBe("2026-10-12T03:30:00.000Z");
    expect(istInstant("2026-10-12", "00:15").toISOString()).toBe("2026-10-11T18:45:00.000Z");
    expect(istTime(new Date("2026-10-12T03:30:00Z"))).toBe("09:00");
  });

  it("round-trips across midnight in India", () => {
    const moment = istInstant("2026-10-12", "00:15");
    expect(istTime(moment)).toBe("00:15");
    expect(istDayOf(moment.toISOString())).toBe("2026-10-12");
  });
});
