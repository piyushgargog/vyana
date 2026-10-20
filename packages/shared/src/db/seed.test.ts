import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CarePlan } from "../contracts";
import { findLastDone } from "../health";

// Guards for the demo seed (supabase/seed): things a SQL test cannot easily check.
const seedDir = join(__dirname, "../../../../supabase/seed");
const seedSql = readFileSync(join(seedDir, "seed.sql"), "utf8");
const seedUsers = readFileSync(join(seedDir, "seed-users.ts"), "utf8");

describe("seed.sql", () => {
  it("holds a care plan that is valid against the CarePlan contract", () => {
    const json = seedSql.match(/\$plan\$([\s\S]*?)\$plan\$::jsonb/)?.[1];
    expect(json).toBeDefined();
    const plan = CarePlan.parse(JSON.parse(json as string));
    expect(plan.condition).toBe("Type 2 Diabetes");
    expect(plan.sources.length).toBeGreaterThanOrEqual(2);
    expect(plan.sources.every((s) => s.url.startsWith("https://"))).toBe(true);
    expect(plan.red_flags.length).toBeGreaterThan(0);
  });

  it("has only care plans that are valid against the CarePlan contract (every demo patient's plan)", () => {
    const plans = [...seedSql.matchAll(/\$plan\$([\s\S]*?)\$plan\$::jsonb/g)].map((m) => m[1]);
    expect(plans.length).toBeGreaterThanOrEqual(9);
    for (const json of plans) {
      const plan = CarePlan.parse(JSON.parse(json));
      expect(plan.sources.length, plan.condition).toBeGreaterThanOrEqual(2);
      expect(plan.sources.every((s) => s.url.startsWith("https://")), plan.condition).toBe(true);
      expect(plan.red_flags.length, plan.condition).toBeGreaterThan(0);
    }
  });

  it("keeps the dose logs of the year-long history out of the future and inside each medicine's dates", () => {
    const section15 = seedSql.slice(seedSql.indexOf("-- 15. Ten more demo PATIENTS"));
    expect(section15).toContain("t.at <= now() - interval '5 minutes'");
    expect(section15).toContain("(t.at at time zone 'Asia/Kolkata')::date >= i.start_date");
    expect(section15).toContain("<= coalesce(i.end_date, current_date)");
  });

  it("has follow-up tests that the reminders can match to the seeded lab results", () => {
    const json = seedSql.match(/\$plan\$([\s\S]*?)\$plan\$::jsonb/)?.[1] as string;
    const plan = CarePlan.parse(JSON.parse(json));
    const labNames = [...seedSql.matchAll(/'(HbA1c|Fasting Blood Sugar)', [\d.]+, '/g)].map((m) => m[1].toLowerCase());
    const lastDone = Object.fromEntries(labNames.map((n) => [n, "2026-01-01"]));
    expect(findLastDone("HbA1c", lastDone)).toBe("2026-01-01");
    expect(plan.follow_up_tests.map((t) => t.test)).toContain("HbA1c");
  });

  it("seeds 8 to 10 hospitals with 4 to 6 departments each", () => {
    const hospitals = seedSql.match(/insert into public\.hospitals[\s\S]*?on conflict/)?.[0] ?? "";
    const rows = [...hospitals.matchAll(/\('51000000-0000-0000-0000-(\d{12})'/g)];
    expect(rows.length).toBeGreaterThanOrEqual(8);
    expect(rows.length).toBeLessThanOrEqual(10);

    const departments = seedSql.match(/insert into public\.departments[\s\S]*?on conflict/)?.[0] ?? "";
    const perHospital = new Map<string, number>();
    for (const m of departments.matchAll(/\('52000000-[0-9a-f-]+', '(51000000-[0-9a-f-]+)'/g)) perHospital.set(m[1], (perHospital.get(m[1]) ?? 0) + 1);
    expect(perHospital.size).toBe(rows.length);
    for (const count of perHospital.values()) {
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(6);
    }
  });

  it("keeps the first hospital and department ids that the earlier seed used", () => {
    expect(seedSql).toContain("'51000000-0000-0000-0000-000000000001'");
    expect(seedSql).toContain("'52000000-0000-0000-0000-000000000001'");
  });

  it("uses only obviously fake phone numbers", () => {
    const phones = [...seedSql.matchAll(/'(\+91[^']*)'/g)].map((m) => m[1]);
    expect(phones.length).toBeGreaterThan(20);
    for (const phone of phones) expect(phone, phone).toMatch(/^\+91 00000 \d{5}$/);
  });

  it("marks every seeded doctor as demo data, never as a real registration", () => {
    expect(seedSql).not.toMatch(/verification_json[^;]*"reg_no"/);
    const regNumbers = [...seedSql.matchAll(/'(DEMO-\d+)'/g)].map((m) => m[1]);
    expect(regNumbers.length).toBeGreaterThanOrEqual(20);
    expect(seedSql).toContain("demo doctor, not a real registration");
  });

  it("logs doses in India time and never in the future", () => {
    expect(seedSql).toContain("at time zone 'Asia/Kolkata'");
    expect(seedSql).toMatch(/if at <= now\(\)/);
  });
});

describe("seed-users.ts and seed.sql agree on the hospital doctors", () => {
  it("creates an account for each of the 18 doctors that seed.sql gives a profile", () => {
    const sqlIds = new Set([...seedSql.matchAll(/\('(00000000-0000-0000-0000-0000000001\d\d)'(?:::uuid)?, '(?:doctor)?/g)].map((m) => m[1]));
    const tsIds = new Set([...seedUsers.matchAll(/id: '(00000000-0000-0000-0000-0000000001\d\d)'/g)].map((m) => m[1]));
    expect(tsIds.size).toBe(18);
    expect([...tsIds].sort()).toEqual([...sqlIds].sort());
  });

  it("uses the .test domain for every account and no password in the script", () => {
    const emails = [...seedUsers.matchAll(/email: '([^']+)'/g)].map((m) => m[1]);
    expect(emails.length).toBe(41);
    for (const e of emails) expect(e, e).toMatch(/@vyana\.test$/);
    expect(seedUsers).toContain("process.env.SEED_PASSWORD_PATIENT");
    expect(seedUsers).toContain("process.env.SEED_PASSWORD_DOCTOR");
    expect(seedUsers).toContain("process.env.SEED_PASSWORD_CAREGIVER");
    expect(seedUsers).toContain("process.env.SEED_PASSWORD_ADMIN");
  });
});
