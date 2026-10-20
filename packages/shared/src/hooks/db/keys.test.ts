import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { QUERY_ROOTS } from "../api/query-roots";
import { DB_KEYS } from "./shared";

const dir = __dirname;
const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "index.ts" && f !== "shared.ts");
const sources = Object.fromEntries(files.map((f) => [f, readFileSync(join(dir, f), "utf8")]));
const allSource = Object.values(sources).join("\n");

describe("DB hook query keys", () => {
  it("start every key with a QUERY_ROOTS or DB_KEYS value (plan 7.2)", () => {
    const keys = [...allSource.matchAll(/queryKey: \[([^,\]]+)/g)].map((m) => m[1].trim());
    expect(keys.length).toBeGreaterThan(20);
    for (const key of keys) expect(key, key).toMatch(/^(QUERY_ROOTS|DB_KEYS)\.\w+$/);
  });

  it("only use roots and keys that exist", () => {
    for (const m of allSource.matchAll(/QUERY_ROOTS\.(\w+)/g)) expect(QUERY_ROOTS).toHaveProperty(m[1]);
    for (const m of allSource.matchAll(/DB_KEYS\.(\w+)/g)) expect(DB_KEYS).toHaveProperty(m[1]);
  });

  it("use the roots that the API hooks invalidate, so a scan or an upload refreshes the screens", () => {
    for (const root of ["prescriptions", "activeItems", "labReports", "labValues", "doctors", "emergency", "carePlans", "hospitals"] as const) {
      expect(allSource, root).toContain(`QUERY_ROOTS.${root}`);
    }
  });

  it("keep DB keys distinct from the QUERY_ROOTS values", () => {
    const roots = new Set<string>(Object.values(QUERY_ROOTS));
    for (const value of Object.values(DB_KEYS)) expect(roots.has(value), value).toBe(false);
  });
});
