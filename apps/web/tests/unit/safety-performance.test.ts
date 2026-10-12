import { describe, expect, it } from "vitest";
import { checkDiagnosisLanguage, findDosePatterns } from "@/lib/server/safety/blocklists";
import { filterCitationsInText } from "@/lib/server/safety/citations";
import { expandSalts, lookupInteractions } from "@/lib/server/safety/interactions-table";
import { redact } from "@/lib/server/safety/redact";
import { matchRedFlags } from "@/lib/server/safety/red-flags";

// These run on user and document text: hostile input must not make them slow (no catastrophic backtracking).
const hostile = [
  " ".repeat(100_000),
  "1".repeat(100_000),
  "1 ".repeat(50_000),
  "a@".repeat(30_000),
  "Name:".repeat(20_000) + " x",
  "Dr. A".repeat(20_000),
  "aapko ".repeat(20_000) + "hai",
  "http://".repeat(15_000),
  "+".repeat(50_000) + "and" + "/".repeat(50_000),
  "Address: " + "a ".repeat(50_000),
];

describe("safety checks stay fast on hostile input", () => {
  it.each(hostile.map((h, i) => [i, h]))("input #%i finishes in under a second", (_i, text) => {
    const started = performance.now();
    redact(text as string, { knownNames: ["Aryan Sharma"] });
    checkDiagnosisLanguage(text as string);
    findDosePatterns(text as string);
    matchRedFlags(text as string);
    filterCitationsInText(text as string, new Set());
    expandSalts((text as string).slice(0, 5000));
    lookupInteractions([(text as string).slice(0, 2000), "warfarin"]);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});
