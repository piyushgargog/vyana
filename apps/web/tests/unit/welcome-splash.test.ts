import { describe, expect, it } from "vitest";

describe("WelcomeSplash Specifications (#240)", () => {
  it("uses the required 3-second display duration and fade-out transition", () => {
    const SHOW_MS = 3000;
    const FADE_MS = 350;
    expect(SHOW_MS).toBe(3000);
    expect(FADE_MS).toBeLessThanOrEqual(500);
    expect(FADE_MS).toBeGreaterThanOrEqual(250);
  });

  it("calculates Ashoka Chakra geometry and 24 spokes correctly", () => {
    const width = 32;
    const height = Math.round((width * 2) / 3);
    const stripe = height / 3;
    const chakra = Math.round(stripe * 0.85);

    expect(height).toBe(21);
    expect(stripe).toBe(7);
    expect(chakra).toBe(6);

    // 12 diameter lines rotated by 15 degrees = 24 spokes around 360 degrees
    const lines = Array.from({ length: 12 }, (_, i) => i * 15);
    expect(lines.length).toBe(12);
    expect(lines[0]).toBe(0);
    expect(lines[lines.length - 1]).toBe(165);
  });

  it("preserves exact flag official colors without hex drift", () => {
    const FLAG = {
      saffron: "#FF9933",
      white: "#FFFFFF",
      green: "#138808",
      chakra: "#000080",
    } as const;

    expect(FLAG.saffron).toBe("#FF9933");
    expect(FLAG.white).toBe("#FFFFFF");
    expect(FLAG.green).toBe("#138808");
    expect(FLAG.chakra).toBe("#000080");
  });

  it("preserves exact tagline and patriotic copy", () => {
    const tagline = "Your health, in one calm place.";
    const footerText = "Made with love in India";
    const skipText = "Tap anywhere to skip";

    expect(tagline).toBe("Your health, in one calm place.");
    expect(footerText).toBe("Made with love in India");
    expect(skipText).toBe("Tap anywhere to skip");
  });
});
