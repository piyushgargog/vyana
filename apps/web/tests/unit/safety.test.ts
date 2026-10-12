import { describe, expect, it } from "vitest";
import { canonicalUrl, filterCitationsInText, filterSources, makeAllowList } from "@/lib/server/safety/citations";
import { RED_FLAG_RULES, matchRedFlags, redFlagLabels } from "@/lib/server/safety/red-flags";
import { evidenceFound, normalizeText, verifyEvidence } from "@/lib/server/safety/verbatim";

describe("verbatim", () => {
  const doc = "Rx\nTab. Dolo 650 mg   1-0-1 after food × 5 days\nSyp. Ascoril LS 5 ml TDS";

  it("ignores case, extra whitespace and unicode dashes", () => {
    expect(normalizeText("Dolo–650  MG")).toBe("dolo-650 mg");
    expect(evidenceFound(doc, "tab. dolo 650 mg 1-0-1")).toBe(true);
    expect(evidenceFound(doc, "Tab. Dolo 650 mg 1–0–1")).toBe(true);
  });

  it("rejects evidence that is missing, empty or not in the document", () => {
    expect(evidenceFound(doc, null)).toBe(false);
    expect(evidenceFound(doc, "   ")).toBe(false);
    expect(evidenceFound(doc, "Dolo 650 mg 1-1-1")).toBe(false);
  });

  it("clears unverified values and marks the row for review", () => {
    const res = verifyEvidence(doc, {
      medicine_name: { value: "Dolo", evidence: "Tab. Dolo 650 mg" },
      dose: { value: "2 tablets", evidence: "2 tablets twice daily" },
      duration_days: { value: 5, evidence: "× 5 days" },
      instructions: { value: null, evidence: null },
    });
    expect(res.values).toEqual({ medicine_name: "Dolo", dose: null, duration_days: 5, instructions: null });
    expect(res.failed).toEqual(["dose"]);
    expect(res.needs_review).toBe(true);
  });

  it("does not ask for review when every value is proven", () => {
    expect(verifyEvidence(doc, { name: { value: "Ascoril LS", evidence: "Syp. Ascoril LS" } }).needs_review).toBe(false);
  });
});

describe("citations", () => {
  const allowed = makeAllowList(["https://www.who.int/news-room/fact-sheets/detail/diabetes", "https://medlineplus.gov/diabetes.html"]);

  it("treats www, trailing slash, scheme and fragment as the same page", () => {
    expect(canonicalUrl("http://WHO.int/news-room/fact-sheets/detail/diabetes/#symptoms")).toBe(
      canonicalUrl("https://www.who.int/news-room/fact-sheets/detail/diabetes"),
    );
    expect(canonicalUrl("javascript:alert(1)")).toBeNull();
    expect(canonicalUrl("not a url")).toBeNull();
  });

  it("keeps fetched links and removes invented ones", () => {
    const text =
      "See https://medlineplus.gov/diabetes.html. Also https://fake-health.example/cure and [WHO](https://www.who.int/news-room/fact-sheets/detail/diabetes).";
    const { cleaned, removed } = filterCitationsInText(text, allowed);
    expect(removed).toEqual(["https://fake-health.example/cure"]);
    expect(cleaned).toContain("https://medlineplus.gov/diabetes.html");
    expect(cleaned).toContain("[WHO](https://www.who.int/news-room/fact-sheets/detail/diabetes)");
    expect(cleaned).not.toContain("fake-health");
  });

  it("keeps the label of a removed markdown link", () => {
    const { cleaned, removed } = filterCitationsInText("Read [this guide](https://made-up.example/x) today.", allowed);
    expect(cleaned).toBe("Read this guide today.");
    expect(removed).toEqual(["https://made-up.example/x"]);
  });

  it("does not treat a different path on an allowed site as allowed", () => {
    expect(filterCitationsInText("https://medlineplus.gov/druginfo/meds/a681004.html", allowed).removed).toHaveLength(1);
  });

  it("filters structured sources", () => {
    const { kept, removed } = filterSources(
      [
        { title: "MedlinePlus", url: "https://medlineplus.gov/diabetes.html" },
        { title: "Invented", url: "https://example.com/diabetes" },
      ],
      allowed,
    );
    expect(kept.map((s) => s.title)).toEqual(["MedlinePlus"]);
    expect(removed).toEqual(["https://example.com/diabetes"]);
  });
});

describe("red flags", () => {
  const cases: [string, string][] = [
    ["I have chest pain and I'm sweating", "chest_pain"],
    ["my father has pain in his chest", "chest_pain"],
    ["seene mein dard ho raha hai", "chest_pain"],
    ["मेरे सीने में दर्द है", "chest_pain"],
    ["I can't breathe properly", "breathing"],
    ["saans lene mein takleef", "breathing"],
    ["सांस लेने में तकलीफ हो रही है", "breathing"],
    ["she fainted in the kitchen", "unconscious"],
    ["dadi behosh ho gayi", "unconscious"],
    ["vomiting blood since morning", "blood_vomit_cough"],
    ["khoon ki ulti", "blood_vomit_cough"],
    ["sudden weakness on one side and slurred speech", "stroke_signs"],
    ["my son is having a seizure", "seizure"],
    ["I want to end my life", "self_harm"],
    ["mujhe marna chahta hoon aisa lagta hai", "self_harm"],
    ["my child swallowed rat poison", "poisoning"],
    ["face and tongue are swollen after the injection", "face_swelling"],
    ["he hit his head on the floor", "head_spine_injury"],
    ["road accident, leg is bleeding heavily", "bleeding"],
  ];

  it.each(cases)("flags %j as %s", (text, id) => {
    expect(matchRedFlags(text)).toContain(id);
  });

  it("stays quiet for everyday symptoms", () => {
    for (const text of ["mild headache since yesterday", "skin rash on my arm for 3 days", "I want to diet and lose weight", "sir mein halka dard", "runny nose and sneezing"]) {
      expect(matchRedFlags(text)).toEqual([]);
    }
  });

  it("returns readable labels", () => {
    expect(redFlagLabels(["chest_pain"])).toEqual(["Chest pain or pressure"]);
  });

  it("has unique rule ids", () => {
    const ids = RED_FLAG_RULES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
