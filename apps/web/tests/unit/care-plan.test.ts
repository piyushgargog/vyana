import { describe, expect, it } from "vitest";
import { PROMPT_PAGE_CHARS, forPrompt, intervalDays, verifyCarePlan, type CarePlanLlm, type Page } from "@/lib/server/care-plan";
import { CONDITION_RED_FLAGS, redFlagsForCondition } from "@/lib/server/safety/condition-red-flags";
import { hasNumber, numbersIn } from "@/lib/server/safety/verbatim";

const pages: Page[] = [
  {
    title: "Diabetes guide",
    url: "https://www.nhs.uk/diabetes",
    text: "Be active for at least 150 minutes a week. Stop smoking. Eat plenty of vegetables, oats and dal. Cut down on sugary drinks. Get your eyes checked once a year. Have your HbA1c checked every 3 to 6 months. Call 999 if you feel faint.",
  },
  { title: "Diet page", url: "https://medlineplus.gov/diet", text: "Choose whole grains such as brown rice." },
];

const b = (text: string, quote: string, source = 1) => ({ text, quote, source });
const empty: CarePlanLlm = { summary: null, do: [], dont: [], diet: { eat_more: [], limit: [], sample_day: [] }, red_flags: [], follow_up_tests: [] };

describe("forPrompt", () => {
  it("gives the model only the start of each page, so prompt and answer fit a free Groq minute", () => {
    const long: Page = { title: "t", url: "https://www.who.int/x", text: "a".repeat(PROMPT_PAGE_CHARS + 500) };
    const short: Page = { title: "s", url: "https://www.nhs.uk/y", text: "short page" };
    const [cut, kept] = forPrompt([long, short]);
    expect(cut.text).toHaveLength(PROMPT_PAGE_CHARS);
    expect(cut.url).toBe(long.url);
    expect(kept).toEqual(short);
  });
});

describe("intervalDays", () => {
  it("computes the interval from the quote's own words", () => {
    expect(intervalDays("Have your HbA1c checked every 3 to 6 months")).toBe(90);
    expect(intervalDays("Get your eyes checked once a year")).toBe(365);
    expect(intervalDays("an annual foot check")).toBe(365);
    expect(intervalDays("check it every two weeks")).toBe(14);
    expect(intervalDays("twice a year")).toBe(182);
    expect(intervalDays("Check your feet regularly")).toBeNull();
  });
});

describe("verifyCarePlan", () => {
  it("keeps only bullets whose quote is on the page they cite", () => {
    const v = verifyCarePlan(
      {
        ...empty,
        do: [b("Be active 150 minutes a week", "Be active for at least 150 minutes a week"), b("Sleep 8 hours", "Sleep well", 1), b("Stop smoking", "Stop smoking", 2)],
        dont: [b("Avoid sugary drinks", "Cut down on sugary drinks")],
      },
      pages,
      "Type 2 diabetes",
      "en",
    );
    expect(v.plan.do).toEqual(["Be active 150 minutes a week"]);
    expect(v.plan.dont).toEqual(["Avoid sugary drinks"]);
    expect(v.dropped).toBe(2); // invented quote; quote on the wrong page
    expect(v.plan.sources.map((s) => s.url)).toContain("https://www.nhs.uk/diabetes");
    expect(v.plan.sources.map((s) => s.url)).not.toContain("https://medlineplus.gov/diet");
  });

  it("drops a bullet whose numbers aren't in its quote, or that mentions a dose or a diagnosis", () => {
    const v = verifyCarePlan(
      {
        ...empty,
        do: [
          b("Be active 300 minutes a week", "Be active for at least 150 minutes a week"),
          b("Take 500 mg metformin and stop smoking", "Stop smoking"),
          b("You have been diagnosed with diabetes, so stop smoking", "Stop smoking"),
          b("Stop smoking", "Stop smoking"),
        ],
      },
      pages,
      "Type 2 diabetes",
      "en",
    );
    expect(v.plan.do).toEqual(["Stop smoking"]);
    expect(v.dropped).toBe(3);
  });

  it("builds the sample day from cited foods only", () => {
    const v = verifyCarePlan(
      {
        ...empty,
        diet: {
          eat_more: [b("Vegetables, oats and dal", "Eat plenty of vegetables, oats and dal"), b("Brown rice", "Choose whole grains such as brown rice", 2)],
          limit: [],
          sample_day: [
            { meal: "breakfast", items: ["oats", "paratha"] },
            { meal: "lunch", items: ["brown rice", "dal"] },
            { meal: "snack", items: ["samosa"] },
          ],
        },
      },
      pages,
      "Type 2 diabetes",
      "en",
    );
    expect(v.plan.diet.sample_day).toEqual([
      { meal: "breakfast", items: ["oats"] },
      { meal: "lunch", items: ["brown rice", "dal"] },
    ]);
  });

  it("computes follow-up intervals in code and drops tests without one", () => {
    const v = verifyCarePlan(
      {
        ...empty,
        do: [b("Stop smoking", "Stop smoking")],
        follow_up_tests: [
          { test: "HbA1c", quote: "Have your HbA1c checked every 3 to 6 months", source: 1 },
          { test: "Eye check", quote: "Get your eyes checked once a year", source: 1 },
          { test: "Kidney test", quote: "Check your kidneys every month", source: 1 },
          { test: "Foot check", quote: "Stop smoking", source: 1 },
        ],
      },
      pages,
      "Type 2 diabetes",
      "en",
    );
    expect(v.plan.follow_up_tests).toEqual([
      { test: "HbA1c", every_days: 90 },
      { test: "Eye check", every_days: 365 },
    ]);
  });

  it("merges the curated red flags and falls back to general emergency signs", () => {
    const withCurated = verifyCarePlan({ ...empty, red_flags: [b("Feeling faint", "Call 999 if you feel faint")] }, pages, "Type 2 diabetes", "en");
    expect(withCurated.plan.red_flags[0]).toBe("Feeling faint");
    expect(withCurated.plan.red_flags).toContain("Chest pain or pressure");
    expect(withCurated.plan.sources.map((s) => s.url)).toContain("https://medlineplus.gov/ency/article/000313.htm");

    const general = verifyCarePlan({ ...empty, do: [b("Stop smoking", "Stop smoking")] }, pages, "Psoriasis", "en");
    expect(general.plan.red_flags).toContain("Chest pain or pressure");
    expect(general.plan.red_flags.length).toBeGreaterThan(5);
  });

  it("uses a fixed summary when the model's isn't backed by a quote, and says when nothing is left", () => {
    const v = verifyCarePlan({ ...empty, summary: b("A lifelong illness", "not on the page") }, pages, "Type 2 diabetes", "hi");
    expect(v.plan.summary).toBe("Type 2 diabetes के लिए देखभाल योजना, भरोसेमंद स्वास्थ्य स्रोतों से।");
    expect(v.hasContent).toBe(false);
  });
});

describe("curated condition red flags", () => {
  it("matches conditions by name and alias, as whole words", () => {
    expect(redFlagsForCondition("Type 2 Diabetes Mellitus").map((c) => c.id)).toEqual(["diabetes"]);
    expect(redFlagsForCondition("Diabetes with high BP").map((c) => c.id)).toEqual(["diabetes", "high_blood_pressure"]);
    expect(redFlagsForCondition("मधुमेह").map((c) => c.id)).toEqual(["diabetes"]);
    expect(redFlagsForCondition("Dengue fever").map((c) => c.id)).toEqual(["dengue"]);
    expect(redFlagsForCondition("Hyperthyroidism")).toEqual([]);
    expect(redFlagsForCondition("Bipolar disorder")).toEqual([]); // "bp" must be a whole word
  });

  it("every item's numbers are in its quote and every quote has a source", () => {
    for (const c of CONDITION_RED_FLAGS) {
      for (const i of c.items) {
        for (const n of numbersIn(i.text)) expect(hasNumber(i.quote, n), `${c.id}: ${i.text}`).toBe(true);
        expect(i.source.url).toMatch(/^https:\/\/(www\.nhs\.uk|medlineplus\.gov)\//);
      }
    }
  });
});
