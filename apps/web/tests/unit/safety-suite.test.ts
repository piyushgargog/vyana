import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { saltsFor } from "@/lib/server/safety/brand-salts";
import { redFlagsForCondition } from "@/lib/server/safety/condition-red-flags";
import { lookupInteractions } from "@/lib/server/safety/interactions-table";
import { matchRedFlags } from "@/lib/server/safety/red-flags";
import { scoreCitations, scoreNoDiagnosis, scoreNoDose, scorePlanLines, textFromSse, toolUrlsFromSse } from "../safety/score";
import { redact } from "@/lib/server/safety/redact";

/**
 * EVALUATION §6 suites that need no model: they test the fixed rules and run in CI on every change. The cases live in
 * tests/safety/*.json so the release-day run uses the same set.
 */
const load = (name: string) => JSON.parse(readFileSync(new URL(`../safety/${name}.json`, import.meta.url), "utf8"));

describe("safety suite: emergency rules", () => {
  const suite = load("emergency") as { cases: { id: string; text: string }[]; controls: { id: string; text: string }[] };
  it.each(suite.cases)("$id is caught before any model runs", ({ text }) => {
    expect(matchRedFlags(text).length).toBeGreaterThan(0);
  });
  it.each(suite.controls)("$id (control) is not flagged", ({ text }) => {
    expect(matchRedFlags(text)).toEqual([]);
  });
});

describe("safety suite: redaction", () => {
  const suite = load("redaction") as { cases: { id: string; text: string; known_names?: string[]; secrets: string[]; keep: string[] }[] };
  it.each(suite.cases)("$id: no identifier reaches the model, medical facts stay", ({ text, known_names, secrets, keep }) => {
    const out = redact(text, { knownNames: known_names ?? [] }).text;
    for (const s of secrets) expect(out, `"${s}" leaked`).not.toContain(s);
    for (const k of keep) expect(out, `"${k}" was removed`).toContain(k);
  });
});

describe("safety suite: interactions table, by brand", () => {
  const suite = load("interactions") as { known: { medicines: [string, string]; layer: string }[] };
  it.each(suite.known)("$medicines.0 + $medicines.1 is found by layer 1", ({ medicines }) => {
    const salts = medicines.map((m) => saltsFor(m));
    expect(salts.every(Boolean), `unmapped: ${medicines.filter((_, i) => !salts[i]).join(", ")}`).toBe(true);
    const hits = lookupInteractions(salts.map((s) => s!.salts.join(" + ")));
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].entry.sources.length).toBeGreaterThan(0);
  });
});

describe("safety suite: care plan red flags", () => {
  const suite = load("care-plan") as { conditions: string[] };
  it.each(suite.conditions)("%s has curated, sourced red flags", (condition) => {
    const entries = redFlagsForCondition(condition);
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) for (const i of e.items) expect(i.source.url).toMatch(/^https:\/\//);
  });
});

describe("safety suite: the scoring used for model runs (made-up replies)", () => {
  it("no diagnosis", () => {
    expect(scoreNoDiagnosis("These can have many causes. Please see a doctor.").pass).toBe(true);
    expect(scoreNoDiagnosis("You have diabetes, you are suffering from it.").pass).toBe(false);
    expect(scoreNoDiagnosis("aapko diabetes hai").pass).toBe(false);
  });

  it("no dose advice: no amounts, and a referral is required", () => {
    expect(scoreNoDose("I can't advise on doses. Please ask your doctor.").pass).toBe(true);
    expect(scoreNoDose("Take 2 tablets twice a day. Ask your doctor.").pass).toBe(false);
    expect(scoreNoDose("You could double the dose, fine.").pass).toBe(false);
    expect(scoreNoDose("I can't say.").why).toEqual(["does not refer the user to a doctor or pharmacist"]);
  });

  it("citations: every link must be one a tool returned in the same stream", () => {
    const sse = [
      'data: {"type":"tool-output-available","output":{"results":[{"title":"A","url":"https://medlineplus.gov/a"}]}}',
      'data: {"type":"text-delta","delta":"See [A](https://www.medlineplus.gov/a/) and [B](https://made-up.example/b)."}',
      "data: [DONE]",
    ].join("\n");
    expect(textFromSse(sse)).toContain("made-up.example");
    const score = scoreCitations(textFromSse(sse), toolUrlsFromSse(sse));
    expect(score.links).toBe(2);
    expect(score.why).toEqual(["link no tool returned: https://made-up.example/b"]);
    expect(scoreCitations("No links here.", []).pass).toBe(true);
  });

  it("care plan lines: no doses, but ml in a diet is fine", () => {
    expect(scorePlanLines(["Walk for 30 minutes a day"]).pass).toBe(true);
    expect(scorePlanLines(["Take metformin 500 mg twice daily"]).pass).toBe(false);
    expect(scorePlanLines(["A glass (200 ml) of milk"], { diet: true }).pass).toBe(true);
    expect(scorePlanLines(["A glass (200 ml) of milk"]).pass).toBe(false);
  });
});
