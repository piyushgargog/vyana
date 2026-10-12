import { describe, expect, it } from "vitest";
import { checkDiagnosisLanguage, hasDosePattern } from "@/lib/server/safety/blocklists";
import {
  INTERACTION_TABLE,
  MAJOR_WORDING,
  TABLE_ADVICE,
  expandSalts,
  lookupInteractions,
  normalizeSalt,
} from "@/lib/server/safety/interactions-table";

describe("interaction table entries", () => {
  it("has unique ids and two different salts per entry", () => {
    const ids = INTERACTION_TABLE.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of INTERACTION_TABLE) {
      expect(e.salts[0]).not.toBe(e.salts[1]);
      expect(e.salts.every((s) => s === normalizeSalt(s))).toBe(true);
    }
  });

  it("cites https sources on trusted health sites for every entry", () => {
    const trusted = ["nhs.uk", "medlineplus.gov", "gov.uk"];
    for (const e of INTERACTION_TABLE) {
      expect(e.sources.length, e.id).toBeGreaterThan(0);
      for (const s of e.sources) {
        const host = new URL(s.url).hostname;
        expect(s.url.startsWith("https://"), s.url).toBe(true);
        expect(trusted.some((d) => host === d || host.endsWith(`.${d}`)), host).toBe(true);
      }
    }
  });

  it("keeps severity tied to the source's wording", () => {
    for (const e of INTERACTION_TABLE.filter((x) => x.severity === "major")) {
      expect(MAJOR_WORDING.some((w) => e.quote.toLowerCase().includes(w)), e.id).toBe(true);
    }
  });

  it("never says safe, never gives a dose, never diagnoses", () => {
    for (const text of [TABLE_ADVICE, ...INTERACTION_TABLE.map((e) => e.effect)]) {
      expect(text.toLowerCase()).not.toMatch(/\bsafe\b/);
      expect(hasDosePattern(text), text).toBe(false);
      expect(checkDiagnosisLanguage(text).phrases, text).toEqual([]);
    }
  });
});

describe("salt names", () => {
  it("normalizes aliases and salt forms", () => {
    expect(normalizeSalt("  Acetylsalicylic   Acid ")).toBe("aspirin");
    expect(normalizeSalt("Nitroglycerin")).toBe("glyceryl trinitrate");
    expect(normalizeSalt("Clopidogrel Bisulfate")).toBe("clopidogrel");
    expect(normalizeSalt("Paracetamol")).toBe("paracetamol");
  });

  it("splits combinations", () => {
    expect(expandSalts("Sulfamethoxazole + Trimethoprim")).toEqual(["sulfamethoxazole", "trimethoprim"]);
    expect(expandSalts("Co-trimoxazole")).toEqual(["sulfamethoxazole", "trimethoprim"]);
    expect(expandSalts("Aspirin/Clopidogrel")).toEqual(["aspirin", "clopidogrel"]);
    expect(expandSalts("Telmisartan and Amlodipine")).toEqual(["telmisartan", "amlodipine"]);
  });
});

describe("lookupInteractions", () => {
  it("finds every curated pair in either order", () => {
    for (const e of INTERACTION_TABLE) {
      for (const order of [e.salts, [e.salts[1], e.salts[0]]]) {
        const hits = lookupInteractions(order);
        expect(hits.map((h) => h.entry.id), `${order.join(" + ")}`).toContain(e.id);
      }
    }
  });

  it("finds pairs through aliases and combination products", () => {
    expect(lookupInteractions(["Methotrexate", "Co-trimoxazole"]).map((h) => h.entry.id).sort()).toEqual([
      "methotrexate+sulfamethoxazole",
      "methotrexate+trimethoprim",
    ]);
    expect(lookupInteractions(["Sildenafil Citrate", "Nitroglycerin"]).map((h) => h.entry.id)).toEqual(["sildenafil+glyceryl-trinitrate"]);
    expect(lookupInteractions(["Warfarin Sodium", "Acetylsalicylic acid"]).map((h) => h.entry.id)).toEqual(["warfarin+aspirin"]);
  });

  it("reports the caller's own medicine names", () => {
    const [hit] = lookupInteractions(["Lithium Carbonate", "Ibuprofen"]);
    expect(hit.medicines).toEqual(["Lithium Carbonate", "Ibuprofen"]);
    expect(hit.entry.severity).toBe("major");
  });

  it("checks every pair in a longer list", () => {
    const hits = lookupInteractions(["Metformin", "Clopidogrel", "Paracetamol", "Omeprazole", "Warfarin", "Ibuprofen"]);
    expect(hits.map((h) => h.entry.id).sort()).toEqual(["clopidogrel+omeprazole", "warfarin+ibuprofen"]);
  });

  it("finds nothing for unrelated or unknown medicines (which is not a safety claim)", () => {
    expect(lookupInteractions(["Paracetamol", "Metformin"])).toEqual([]);
    expect(lookupInteractions(["Dolo 650", "Telma 40"])).toEqual([]);
    expect(lookupInteractions(["Warfarin"])).toEqual([]);
    expect(lookupInteractions([])).toEqual([]);
  });

  it("doesn't pair a medicine with itself", () => {
    expect(lookupInteractions(["Clopidogrel"])).toEqual([]);
  });
});
