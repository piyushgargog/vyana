import { describe, expect, it } from "vitest";
import { candidatesFor, effectOk, severityOf } from "@/lib/server/interactions";
import { BRAND_SALTS, KNOWN_SALTS, saltsFor } from "@/lib/server/safety/brand-salts";

describe("saltsFor", () => {
  it("reads a salt in brackets, a curated brand, or a known salt name", () => {
    expect(saltsFor("Telma (Telmisartan)")).toEqual({ salts: ["telmisartan"], via: "bracket" });
    expect(saltsFor("Dolo 650")).toEqual({ salts: ["paracetamol"], via: "brand" });
    expect(saltsFor("Pan 40 mg tablet")).toEqual({ salts: ["pantoprazole"], via: "brand" });
    expect(saltsFor("Galvus Met 50/1000")?.salts).toEqual(["vildagliptin", "metformin"]);
    expect(saltsFor("Met XL 25")?.salts).toEqual(["metoprolol"]);
    expect(saltsFor("Thyronorm 25mcg")?.salts).toEqual(["levothyroxine"]);
    expect(saltsFor("Augmentin 625 Duo")?.salts).toEqual(["amoxicillin", "clavulanic acid"]);
    expect(saltsFor("Metformin 500 mg")).toEqual({ salts: ["metformin"], via: "salt" });
    expect(saltsFor("Clopidogrel 75 mg tablet")?.salts).toEqual(["clopidogrel"]);
  });

  it("never guesses an unknown name", () => {
    expect(saltsFor("Glycinorm 80")).toBeNull();
    expect(saltsFor("Shelcal 500")).toBeNull();
    expect(saltsFor("Pan-D")).toBeNull();
    expect(saltsFor("Metformin and Unknownzol")).toBeNull();
  });

  it("every curated brand maps to known salts on a 1mg product page", () => {
    expect(BRAND_SALTS.length).toBe(44);
    for (const b of BRAND_SALTS) {
      expect(b.url, b.brand).toMatch(/^https:\/\/www\.1mg\.com\/(drugs|otc)\//);
      for (const s of b.salts) expect(KNOWN_SALTS.has(s), `${b.brand}: ${s}`).toBe(true);
    }
  });
});

describe("severityOf", () => {
  it("follows the source's own words", () => {
    expect(severityOf("Do not take sildenafil with nitrates.")).toBe("major");
    expect(severityOf("Combining these is contraindicated.")).toBe("major");
    expect(severityOf("Aspirin may increase the risk of bleeding with clopidogrel.")).toBe("moderate");
    expect(severityOf("Tell your doctor if you take aspirin.")).toBe("minor");
  });
});

describe("effectOk", () => {
  const quote = "Aspirin may increase the risk of bleeding when taken with clopidogrel.";
  it("accepts a plain restatement", () => {
    expect(effectOk("Taking both may raise the risk of bleeding.", quote)).toBe(true);
  });
  it("rejects numbers, doses, diagnoses, 'safe', and long text", () => {
    expect(effectOk("Bleeding risk rises by 40%.", quote)).toBe(false);
    expect(effectOk("Take 75 mg only.", quote)).toBe(false);
    expect(effectOk("You have been diagnosed with a bleeding disorder.", quote)).toBe(false);
    expect(effectOk("They are safe together in small amounts.", quote)).toBe(false);
    expect(effectOk("x".repeat(201), quote)).toBe(false);
    expect(effectOk("  ", quote)).toBe(false);
  });
});

describe("candidatesFor", () => {
  const pages = [
    {
      title: "Clopidogrel: MedlinePlus Drug Information",
      url: "https://medlineplus.gov/druginfo/meds/a601040.html",
      text: "Tell your doctor if you take aspirin or other blood thinners, because bleeding is more likely.\n\nStore clopidogrel at room temperature.\n\n* omeprazole (Prilosec)\n\nAspirinated drinks are not a thing.",
    },
    { title: "Aspirin and you", url: "https://www.nhs.uk/aspirin", text: "Taking aspirin with clopidogrel can increase the chance of bleeding." },
  ];
  it("picks passages naming the other medicine on a page about the first, whole words only", () => {
    const c = candidatesFor("aspirin", "clopidogrel", pages).map((x) => x.text);
    expect(c[0]).toBe("Taking aspirin with clopidogrel can increase the chance of bleeding."); // both named first
    expect(c).toContain("Tell your doctor if you take aspirin or other blood thinners, because bleeding is more likely.");
    expect(c.some((t) => t.startsWith("Aspirinated"))).toBe(false);
    expect(c.some((t) => t.includes("room temperature"))).toBe(false);
  });
});
