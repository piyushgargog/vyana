/**
 * Creates the TinyFish Monitor for drug quality alerts after the first deploy (ADR-049, RUNBOOK §4).
 * The Monitor searches the CDSCO alert pages twice a day and posts new results to the app's webhook, which keeps
 * only government sources and matches them to patients' medicines in code.
 *
 * Needs TINYFISH_API_KEY, MONITOR_WEBHOOK_SECRET, NEXT_PUBLIC_SUPABASE_URL and
 * SUPABASE_SERVICE_ROLE_KEY in apps/web/.env.local, and the public address of the deployed app.
 *
 *   pnpm monitor:create https://app.example.com --dry-run   # prints what it would create, calls nothing
 *   pnpm monitor:create https://app.example.com             # creates the Monitor and records its id in tinyfish_monitors
 */
import { fileURLToPath } from "node:url";
import { supabaseAdmin } from "../apps/web/lib/server/supabase-admin";
import { createSearchMonitor } from "../apps/web/lib/server/tinyfish/client";

try {
  process.loadEnvFile(fileURLToPath(new URL("../apps/web/.env.local", import.meta.url)));
} catch {
  // Fall back to variables already in the environment.
}

const QUERY = "site:cdsco.gov.in drug alert not of standard quality spurious";
const SCHEDULE = "0 */12 * * *";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const base = args.find((a) => !a.startsWith("--"));

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!base || !/^https:\/\/[^/\s]+$/.test(base)) fail("Give the public https address of the app without a path, e.g. https://app.example.com");
if (process.env.TINYFISH_MOCK === "1") fail("TINYFISH_MOCK=1 is set: unset it to create a real Monitor.");
const secret = process.env.MONITOR_WEBHOOK_SECRET;
if (!secret) fail("MONITOR_WEBHOOK_SECRET is missing in apps/web/.env.local.");

const webhook = `${base}/api/webhooks/tinyfish-monitor?secret=${encodeURIComponent(secret)}`;
console.log(`Monitor: "${QUERY}", schedule "${SCHEDULE}" (UTC), webhook ${base}/api/webhooks/tinyfish-monitor?secret=***`);
if (dryRun) {
  console.log("Dry run: nothing was created.");
  process.exit(0);
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are needed to record the Monitor id.");

const db = supabaseAdmin();
const { data: existing, error: readError } = await db.from("tinyfish_monitors").select("tinyfish_id").eq("query", QUERY).limit(1);
if (readError) fail(`Could not read tinyfish_monitors: ${readError.message}`);
if (existing?.length) fail(`A Monitor for this query already exists (${existing[0].tinyfish_id}). Delete it first if you want to recreate it.`);

const created = await createSearchMonitor({
  name: "Vyana drug quality alerts",
  query: QUERY,
  schedule_cron: SCHEDULE,
  result_limit: 10,
  purpose: "Find new CDSCO drug quality alerts so patients who take an affected medicine can be told.",
  webhook_url: webhook,
});
const { error: insertError } = await db.from("tinyfish_monitors").insert({ tinyfish_id: created.id, query: QUERY });
if (insertError) fail(`The Monitor ${created.id} was created but not recorded: ${insertError.message}. Record it by hand or delete it in the TinyFish dashboard.`);
console.log(`Created Monitor ${created.id} and recorded it in tinyfish_monitors.`);
