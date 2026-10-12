import { describe, expect, it } from "vitest";
import { ADVICE, DISCLAIMER, TRIAGE_WATCH_FOR, matchDepartments } from "@/lib/server/triage";
import { checkDiagnosisLanguage, hasDosePattern } from "@/lib/server/safety/blocklists";
import { RED_FLAG_RULES } from "@/lib/server/safety/red-flags";

describe("matchDepartments", () => {
  const allowed = ["Cardiology", "Dermatology", "General Medicine", "ENT"];
  it("keeps allowed names ignoring case and spaces, in order, at most 2", () => {
    expect(matchDepartments(["dermatology", "General  medicine", "Cardiology"], allowed)).toEqual(["Dermatology", "General Medicine"]);
    expect(matchDepartments(["Skin", "Astrology", "ent"], allowed)).toEqual(["ENT"]);
    expect(matchDepartments(["Dermatology", "dermatology"], allowed)).toEqual(["Dermatology"]);
  });
});

describe("fixed triage texts", () => {
  it("never diagnose or mention a dose, in any language", () => {
    for (const lang of ["en", "hi", "hinglish"] as const) {
      const texts = [ADVICE[lang].emergency(""), ADVICE[lang].soon("Dermatology"), ADVICE[lang].routine("Dermatology"), DISCLAIMER[lang]];
      for (const t of texts) {
        const c = checkDiagnosisLanguage(t);
        expect(c.phrases.concat(c.diseases), t).toEqual([]);
        expect(hasDosePattern(t), t).toBe(false);
      }
    }
  });

  it("watch-for signs are real rule ids", () => {
    const ids = new Set(RED_FLAG_RULES.map((r) => r.id));
    for (const id of TRIAGE_WATCH_FOR) expect(ids.has(id), id).toBe(true);
  });
});
