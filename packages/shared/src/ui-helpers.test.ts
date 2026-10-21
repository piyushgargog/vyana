import { describe, expect, it } from "vitest";

import { relativeTime, shareLinkSubtitle } from "./ui-helpers";

const NOW = new Date("2026-10-21T12:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString();

describe("relativeTime", () => {
  it("clamps the future and the first minute to 'just now'", () => {
    expect(relativeTime(ago(-5 * 60_000), NOW)).toBe("just now");
    expect(relativeTime(ago(30_000), NOW)).toBe("just now");
    expect(relativeTime(ago(59_000), NOW)).toBe("just now");
  });

  it("floors minutes and hours instead of rounding up", () => {
    expect(relativeTime(ago(59 * 60_000), NOW)).toBe("59 min ago");
    expect(relativeTime(ago(60 * 60_000), NOW)).toBe("1 h ago");
    expect(relativeTime(ago(90 * 60_000), NOW)).toBe("1 h ago");
    expect(relativeTime(ago(23.5 * 3_600_000), NOW)).toBe("23 h ago");
  });

  it("floors days and falls back to a date after 30 days", () => {
    expect(relativeTime(ago(24 * 3_600_000), NOW)).toBe("1 d ago");
    expect(relativeTime(ago(29.6 * 86_400_000), NOW)).toBe("29 d ago");
    const old = relativeTime(ago(45 * 86_400_000), NOW);
    expect(old).not.toContain("ago");
    expect(old).toContain("2026");
  });
});

describe("shareLinkSubtitle", () => {
  const base: Parameters<typeof shareLinkSubtitle>[0] = {
    kind: "timeline",
    scopes: ["labs", "vitals"],
    expires_at: "2026-10-24T12:00:00Z",
    open_count: 0,
    last_opened_at: null,
  };

  it("names the scopes, the expiry and that the link is unopened", () => {
    const s = shareLinkSubtitle(base, NOW);
    expect(s).toContain("Includes Labs, Vitals");
    expect(s).toContain("Expires");
    expect(s).toContain("Not opened yet");
  });

  it("counts opens with a relative last-opened time", () => {
    const s = shareLinkSubtitle(
      { ...base, open_count: 3, last_opened_at: ago(2 * 3_600_000) },
      NOW
    );
    expect(s).toContain("Opened 3 times, last 2 h ago");
    const once = shareLinkSubtitle(
      { ...base, scopes: [], open_count: 1, last_opened_at: ago(5 * 60_000) },
      NOW
    );
    expect(once).toContain("No summary sections");
    expect(once).toContain("Opened 1 time, last 5 min ago");
  });

  it("says nothing about scopes for a medical_id link", () => {
    const s = shareLinkSubtitle({ ...base, kind: "medical_id" }, NOW);
    expect(s).not.toContain("Includes");
  });
});
