import { describe, expect, it } from "vitest";

import { supportsInteractiveWidget, withInteractiveWidget } from "@/components/keyboard-guard";

/**
 * #362: the `interactive-widget` viewport key (#245) is added at runtime, and only in Chromium — WebKit logs
 * the key it does not know as a console error, so Safari must never be given it.
 */
describe("supportsInteractiveWidget", () => {
  it("is true when the browser exposes userAgentData (Chromium)", () => {
    const nav = { userAgentData: { brands: [] } } as unknown as Navigator;
    expect(supportsInteractiveWidget(nav)).toBe(true);
  });

  it("is false when userAgentData is absent (Safari, Firefox, Chrome on iOS)", () => {
    const nav = {} as unknown as Navigator;
    expect(supportsInteractiveWidget(nav)).toBe(false);
  });
});

describe("withInteractiveWidget", () => {
  it("appends the key to the viewport the layout serves", () => {
    expect(withInteractiveWidget("width=device-width, initial-scale=1")).toBe(
      "width=device-width, initial-scale=1, interactive-widget=resizes-content",
    );
  });

  it("does not add the key twice", () => {
    const once = withInteractiveWidget("width=device-width, initial-scale=1");
    expect(withInteractiveWidget(once)).toBe(once);
  });

  it("works on an empty content string", () => {
    expect(withInteractiveWidget("")).toBe("interactive-widget=resizes-content");
  });
});
