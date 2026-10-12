/**
 * Re-checks the curated care plan red flags against the live source pages (free TinyFish Fetch calls):
 *   - every item's quote appears word for word on its source
 *   - every number in an item's text appears in its quote
 * Run after any change to apps/web/lib/server/safety/condition-red-flags.ts, and before a release.
 *
 *   pnpm verify:red-flags
 */
import { fileURLToPath } from "node:url";
import { CONDITION_RED_FLAGS } from "../apps/web/lib/server/safety/condition-red-flags";
import { evidenceFound, hasNumber, numbersIn } from "../apps/web/lib/server/safety/verbatim";
import { fetchPages } from "../apps/web/lib/server/tinyfish/client";

try {
  process.loadEnvFile(fileURLToPath(new URL("../apps/web/.env.local", import.meta.url)));
} catch {
  // Fall back to variables already in the environment.
}
if (process.env.TINYFISH_MOCK === "1") {
  console.error("TINYFISH_MOCK=1 is set: unset it to check the live pages.");
  process.exit(1);
}

const urls = [...new Set(CONDITION_RED_FLAGS.flatMap((c) => c.items.map((i) => i.source.url)))];
const pages = new Map<string, string>();
for (let i = 0; i < urls.length; i += 10) {
  const res = await fetchPages({ urls: urls.slice(i, i + 10), purpose: "Check quotes in a curated list of care plan red flags" }, { timeoutMs: 120_000 });
  for (const r of res.results) pages.set(r.url, r.text ?? "");
  for (const e of res.errors) console.log(`FETCH FAILED ${e.url}: ${e.error}`);
}

let failures = 0;
let items = 0;
for (const c of CONDITION_RED_FLAGS) {
  for (const it of c.items) {
    items++;
    const problems: string[] = [];
    const page = pages.get(it.source.url);
    if (page === undefined) problems.push(`could not fetch ${it.source.url}`);
    else if (!evidenceFound(page, it.quote)) problems.push("quote not found on the source");
    for (const n of numbersIn(it.text)) if (!hasNumber(it.quote, n)) problems.push(`number ${n} not in the quote`);
    if (problems.length) failures++;
    console.log(`${problems.length ? "FAIL" : "OK  "} ${c.id.padEnd(20)} ${it.text.slice(0, 60).padEnd(60)} ${problems.join("; ")}`);
  }
}
console.log(failures ? `\n${failures} of ${items} items failed` : `\nAll ${items} items verified against ${pages.size} pages`);
process.exit(failures ? 1 : 0);
