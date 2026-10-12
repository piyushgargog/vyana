import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { saltsFor } from "@/lib/server/safety/brand-salts";
import { redFlagsForCondition } from "@/lib/server/safety/condition-red-flags";
import { lookupInteractions } from "@/lib/server/safety/interactions-table";
import { matchRedFlags } from "@/lib/server/safety/red-flags";
import { redact } from "@/lib/server/safety/redact";
import { plausiblePrice } from "@/lib/server/tinyfish/basket";
import { PHARMACIES, absoluteUrl, isOnDomain } from "@/lib/server/tinyfish/sources";

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

describe("safety suite: prices", () => {
  type Case = { id: string; pharmacy: string; product_url: string; price: unknown; mrp: number | null; expect: "dropped" | "price_null" | "kept" };
  const suite = load("prices") as { cases: Case[] };
  it.each(suite.cases)("$id → $expect", ({ pharmacy, product_url, price, mrp, expect: want }) => {
    const p = PHARMACIES.find((x) => x.source === pharmacy);
    expect(p).toBeDefined();
    // The same two checks processPharmacyResult runs on every agent line (SPEC §12, PLAN §2A).
    const url = absoluteUrl(product_url, p!.searchUrl("dolo 650"));
    const linked = Boolean(url && isOnDomain(url, p!.domain));
    const unit = linked ? plausiblePrice(price as number, mrp) : null;
    const got = !linked ? "dropped" : unit === null ? "price_null" : "kept";
    expect(got).toBe(want);
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
