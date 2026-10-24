import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { resolveLanguage } from "@/lib/server/language";

describe("resolveLanguage", () => {
  it("uses the stored preference when there is no override", () => {
    expect(resolveLanguage(undefined, "en")).toBe("en");
    expect(resolveLanguage(undefined, "hi")).toBe("hi");
    expect(resolveLanguage(undefined, "hinglish")).toBe("hinglish");
    expect(resolveLanguage(null, "hi")).toBe("hi");
  });

  it("lets an explicit override win over the stored preference", () => {
    expect(resolveLanguage("hi", "en")).toBe("hi");
    expect(resolveLanguage("en", "hi")).toBe("en");
    expect(resolveLanguage("hinglish", undefined)).toBe("hinglish");
  });

  it("falls back to English when the stored value is missing or not a language", () => {
    for (const raw of [undefined, null, "", "fr", "EN", 42, true, {}, ["hi"]]) {
      expect(resolveLanguage(undefined, raw)).toBe("en");
    }
  });

  it("resolves the language of another user from their raw fetched value (the care-plan shape)", () => {
    // The care plan fetches the patient's profile through the admin client, so the helper
    // takes the override and that raw row value, not the caller's own profile.
    const patient = { preferred_language: "hinglish" } as { preferred_language?: unknown } | null;
    expect(resolveLanguage(undefined, patient?.preferred_language)).toBe("hinglish");
    expect(resolveLanguage("hi", patient?.preferred_language)).toBe("hi");

    const noPatient = null as { preferred_language?: unknown } | null;
    expect(resolveLanguage(undefined, noPatient?.preferred_language)).toBe("en");
    expect(resolveLanguage("en", noPatient?.preferred_language)).toBe("en");
  });
});
