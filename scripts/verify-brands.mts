/**
 * Re-checks the curated brand → salt list against the live product pages (free TinyFish Fetch calls):
 *   - the brand's first word appears on its page
 *   - every name in `on_page` appears on its page
 * Run after any change to apps/web/lib/server/safety/brand-salts.ts, and before a release.
 *
 *   pnpm verify:brands
 */
import { fileURLToPath } from "node:url";
import { BRAND_SALTS } from "../apps/web/lib/server/safety/brand-salts";
import { normalizeText } from "../apps/web/lib/server/safety/verbatim";
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

const urls = [...new Set(BRAND_SALTS.map((b) => b.url))];
const pages = new Map<string, string>();
for (let i = 0; i < urls.length; i += 10) {
  const res = await fetchPages({ urls: urls.slice(i, i + 10), purpose: "Check a curated brand to salt list" }, { timeoutMs: 120_000 });
  for (const r of res.results) pages.set(r.url, normalizeText(r.text ?? ""));
  for (const e of res.errors) console.log(`FETCH FAILED ${e.url}: ${e.error}`);
}

let failures = 0;
for (const b of BRAND_SALTS) {
  const page = pages.get(b.url);
  const problems: string[] = [];
  if (page === undefined) problems.push("could not fetch");
  else {
    if (!page.includes(b.brand.toLowerCase().split(" ")[0])) problems.push("brand not on the page");
    for (const s of b.on_page) if (!page.includes(s)) problems.push(`"${s}" not on the page`);
  }
  if (problems.length) failures++;
  console.log(`${problems.length ? "FAIL" : "OK  "} ${b.brand.padEnd(14)} ${b.salts.join(" + ").padEnd(40)} ${problems.join("; ")}`);
}
console.log(failures ? `\n${failures} of ${BRAND_SALTS.length} brands failed` : `\nAll ${BRAND_SALTS.length} brands verified against ${pages.size} pages`);
process.exit(failures ? 1 : 0);
