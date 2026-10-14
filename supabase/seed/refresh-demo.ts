/**
 * Refreshes the demo data on the live database (issue #141).
 *
 * Deletes every row that belongs to the demo (@vyana.test) users and re-seeds
 * the demo sections of seed.sql, so the demo patient and doctor look full and
 * believable for screenshots and the video. Dates in seed.sql are relative to
 * the seed day, so the data never looks stale.
 *
 * Safety:
 * - Refuses a non-local database unless ALLOW_LIVE_SEED=yes is set.
 * - Only touches rows whose user id is one of the fixed demo UUIDs below.
 *   Real users' rows are never touched.
 * - Prints the project ref only, never a key or connection string.
 *
 * Run (Piyush, on 16 Oct after the team lead says go):
 *   pnpm seed:demo:refresh
 *
 * Needs SUPABASE_DB_URL (or SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY) and
 * psql on PATH.
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const DEMO_IDS = [
  "00000000-0000-0000-0000-000000000001", // patient
  "00000000-0000-0000-0000-000000000002", // doctor
  "00000000-0000-0000-0000-000000000003", // doctor2
  "00000000-0000-0000-0000-000000000004", // admin
  "00000000-0000-0000-0000-000000000005", // caregiver
  ...Array.from({ length: 18 }, (_, i) => `00000000-0000-0000-0000-0000000001${String(i + 1).padStart(2, "0")}`),
];

const dbUrl = process.env.SUPABASE_DB_URL ?? "";
const supabaseUrl = process.env.SUPABASE_URL ?? "";

function isLocal(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host === "::1";
  } catch {
    return false;
  }
}

function projectRef(url: string): string {
  try {
    return new URL(url).hostname.split(".")[0] || "(unknown)";
  } catch {
    return "(unparseable url)";
  }
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!dbUrl) fail("Set SUPABASE_DB_URL to the database connection string (never commit it).");
if (!isLocal(dbUrl) && process.env.ALLOW_LIVE_SEED !== "yes") {
  fail(
    `Refusing: this would refresh the demo data on the live project "${projectRef(supabaseUrl || dbUrl)}". ` +
      "Set ALLOW_LIVE_SEED=yes to do it on purpose."
  );
}

// Tables with demo rows, child-first so foreign keys don't complain.
// The id column that holds the demo user id differs per table.
const DELETES: Array<[table: string, column: string]> = [
  ["dose_logs", "patient_id"],
  ["lab_values", "patient_id"],
  ["vitals", "patient_id"],
  ["meal_logs", "patient_id"],
  ["prescription_items", "patient_id"],
  ["care_plans", "patient_id"],
  ["lab_reports", "patient_id"],
  ["conditions", "patient_id"],
  ["appointments", "patient_id"],
  ["prescriptions", "patient_id"],
  ["emergency_contacts", "patient_id"],
  ["consents", "user_id"],
  ["care_links", "patient_id"],
  ["care_links", "caregiver_id"],
  ["doctors", "id"],
  ["profiles", "id"],
];

const ids = DEMO_IDS.map((id) => `'${id}'`).join(", ");
const deleteSql = DELETES.map(
  ([table, column]) => `delete from public.${table} where ${column} in (${ids});`
).join("\n");

console.log(`Deleting demo rows from ${DELETES.length} table scopes...`);
execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-c", deleteSql], { stdio: "inherit" });

// Re-seed the demo sections of seed.sql (1 and 4-13). Sections 2-3 are
// reference data (hospitals, doctor details) and are left alone.
const seedPath = fileURLToPath(new URL("./seed.sql", import.meta.url));
const seed = readFileSync(seedPath, "utf8");
const sections = seed.split(/^-- \d+\. /m);
// sections[0] is the header; [1] is section 1, [4..13] are sections 4-13.
const wanted = [sections[1], ...sections.slice(4, 14)].filter(Boolean).join("\n-- ");
if (!wanted.trim()) fail("Could not find the demo sections in seed.sql.");

console.log("Re-seeding the demo sections...");
execFileSync("psql", [dbUrl, "-v", "ON_ERROR_STOP=1", "-c", wanted], { stdio: "inherit" });

console.log("Demo data refreshed. Only @vyana.test rows were touched.");
