import { describe, expect, it } from "vitest";
import { saltsFor } from "@/lib/server/safety/brand-salts";
import { redFlagsForCondition } from "@/lib/server/safety/condition-red-flags";
import { expandSalts, normalizeSalt } from "@/lib/server/safety/interactions-table";
import { matchRedFlags } from "@/lib/server/safety/red-flags";
import { normalizeSafetyWord, normalizeText, tokenizeSafetyText } from "@/lib/server/safety/text";

/**
 * Issue #663: the six safety files share one text pipeline, so the same name matches the same way in every
 * check. These tests pin the agreement, including the splits the issue names.
 */
describe("shared safety text pipeline", () => {
  it("spells can't the same way everywhere", () => {
    expect(tokenizeSafetyText("I can't breathe")).toEqual(["i", "cant", "breathe"]);
    expect(normalizeSafetyWord("can't")).toBe("cant");
    expect(matchRedFlags("I can't breathe properly")).toContain("breathing");
    expect(matchRedFlags("I have chest-pain")).toContain("chest_pain");
  });

  it("folds unicode dashes before every matcher", () => {
    expect(normalizeText("Isosorbide‐5‐Mononitrate")).toBe("isosorbide-5-mononitrate");
    expect(normalizeSalt("Isosorbide‐5‐Mononitrate")).toBe("isosorbide mononitrate");
    expect(expandSalts("Co‐trimoxazole")).toEqual(["sulfamethoxazole", "trimethoprim"]);
    expect(saltsFor("Isosorbide 5‐mononitrate 20 mg")?.salts).toEqual(["isosorbide mononitrate"]);
    expect(redFlagsForCondition("Pre‐eclampsia").map((c) => c.id)).toContain("pregnancy");
  });

  it("reads a hyphenated brand line as the brand", () => {
    expect(saltsFor("Dolo-650")?.salts).toEqual(["paracetamol"]);
    expect(saltsFor("Telma (Telmisartan) 40 mg")).toEqual({ salts: ["telmisartan"], via: "bracket" });
  });

  it("keeps salt names whole through the brand and table matchers", () => {
    expect(normalizeSalt("  Acetylsalicylic   Acid ")).toBe("aspirin");
    expect(expandSalts("Sulfamethoxazole + Trimethoprim")).toEqual(["sulfamethoxazole", "trimethoprim"]);
  });
});
