import { beforeEach, describe, expect, it } from "vitest";

import {
  aiUsageTodayMock,
  joinWaitlistMock,
  nextIstMidnight,
  plansMock,
  resetWaitlistMock,
} from "./plans";

beforeEach(() => resetWaitlistMock());

describe("plans and waitlist mocks (#305)", () => {
  it("everyone starts on Free, and the page's numbers live on the plans", () => {
    expect(plansMock.current_slug).toBe("free");
    const free = plansMock.plans.find((p) => p.slug === "free");
    const family = plansMock.plans.find((p) => p.slug === "family");
    expect(free?.features.join(" ")).toContain(String(free?.ai_uses_per_day));
    expect(family?.features.join(" ")).toContain(String(family?.ai_uses_per_day));
  });

  it("no plan promises a price or a date", () => {
    const text = plansMock.plans
      .flatMap((p) => [p.name, ...p.features])
      .join(" ")
      .toLowerCase();
    expect(text).not.toMatch(/₹|\brs\.?\b|\$\s?\d|per month|\/month|launch|opens on|coming on/);
  });

  it("joining twice with the same email answers already_on_list", () => {
    expect(joinWaitlistMock({ email: "Asha@Example.com" })).toEqual({ status: "joined" });
    expect(joinWaitlistMock({ email: "asha@example.com" })).toEqual({
      status: "already_on_list",
    });
    expect(joinWaitlistMock({ email: "other@example.com" })).toEqual({ status: "joined" });
  });

  it("the usage count resets at the next midnight in India", () => {
    // 2026-10-21 20:00 UTC is 2026-10-22 01:30 IST, so the reset is 2026-10-23 00:00 IST.
    const reset = nextIstMidnight(new Date("2026-10-21T20:00:00.000Z"));
    expect(reset).toBe("2026-10-22T18:30:00.000Z");
    expect(aiUsageTodayMock.limit).toBe(
      plansMock.plans.find((p) => p.slug === plansMock.current_slug)?.ai_uses_per_day
    );
    expect(aiUsageTodayMock.used).toBeLessThan(aiUsageTodayMock.limit);
  });
});
