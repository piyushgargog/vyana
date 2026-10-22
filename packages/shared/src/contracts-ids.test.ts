import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { GenerateCarePlanReq, InteractionsReq } from "./contracts";

// Regression (ADR-052): the demo seed uses simple ids such as dddddddd-dddd-dddd-dddd-dddddddddddd. A strict
// uuid() check rejected them, so every route given a seeded id answered 400 (found by the first live check).
const seedSql = readFileSync(join(__dirname, "../../../supabase/seed/seed.sql"), "utf8");
const ids = [...new Set(seedSql.match(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi) ?? [])];

describe("ids in the contract", () => {
  it("the seed has ids to check", () => {
    expect(ids.length).toBeGreaterThan(50);
  });

  it("every id in the seed is accepted wherever a route takes an id", () => {
    for (const id of ids) {
      expect(GenerateCarePlanReq.safeParse({ condition_id: id }).success, id).toBe(true);
      expect(InteractionsReq.safeParse({ prescription_id: id }).success, id).toBe(true);
    }
  });

  it("still rejects things that are not ids", () => {
    for (const bad of ["", "not-an-id", "dddddddd-dddd-dddd-dddd-ddddddddddd", "dddddddd-dddd-dddd-dddd-dddddddddddg", "1' or '1'='1"]) {
      expect(GenerateCarePlanReq.safeParse({ condition_id: bad }).success, bad).toBe(false);
    }
  });
});
