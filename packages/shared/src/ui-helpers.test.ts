import { describe, expect, it } from "vitest";

import { relativeTime, shareLinkSubtitle, telHref } from "./ui-helpers";

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

  it("does not crash on a row from a database without migration 0014 (no scopes, no open_count)", () => {
    const old = { kind: "timeline", expires_at: "2026-10-23T09:00:00.000Z" } as unknown as Parameters<typeof shareLinkSubtitle>[0];
    const text = shareLinkSubtitle(old, new Date("2026-10-22T09:00:00.000Z"));
    expect(text).toContain("No summary sections");
    expect(text).toContain("Not opened yet");
  });

  it("says nothing about scopes for a medical_id link", () => {
    const s = shareLinkSubtitle({ ...base, kind: "medical_id" }, NOW);
    expect(s).not.toContain("Includes");
  });
});

describe("telHref", () => {
  it("links a plain number, keeping a leading +", () => {
    expect(telHref("98110 12345")).toBe("tel:9811012345");
    expect(telHref("+91 98110-12345")).toBe("tel:+919811012345");
    expect(telHref("(011) 4155.1234")).toBe("tel:01141551234");
  });

  it("refuses anything that is not a phone number", () => {
    expect(telHref(null)).toBeNull();
    expect(telHref("")).toBeNull();
    expect(telHref("12345")).toBeNull();
    expect(telHref("call the desk")).toBeNull();
    expect(telHref("+91-98110-12345-67890")).toBeNull();
  });
});
