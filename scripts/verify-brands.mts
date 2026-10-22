/**
 * Re-checks the curated brand → salt list against the live product pages (read with the app's own page reader):
 *   - the brand's first word appears on its page
 *   - every name in `on_page` appears on its page
 * Run after any change to apps/web/lib/server/safety/brand-salts.ts, and before a release.
 *
 *   pnpm verify:brands
 */
import { fileURLToPath } from "node:url";
import { BRAND_SALTS } from "../apps/web/lib/server/safety/brand-salts";
import { normalizeText } from "../apps/web/lib/server/safety/verbatim";
import { fetchPage } from "../apps/web/lib/server/web/fetch-page";

try {
  process.loadEnvFile(fileURLToPath(new URL("../apps/web/.env.local", import.meta.url)));
} catch {
  // Fall back to variables already in the environment.
}
if (process.env.WEB_MOCK === "1") {
  console.error("WEB_MOCK=1 is set: unset it to check the live pages.");
  process.exit(1);
}

const urls = [...new Set(BRAND_SALTS.map((b) => b.url))];
const pages = new Map<string, string>();
// Only the hosts of the curated source URLs may be read (the allow-list of this check).
const allowed = [...new Set(urls.map((u) => new URL(u).hostname))];
for (const url of urls) {
  const page = await fetchPage(url, allowed, 400_000);
  if (page) pages.set(url, normalizeText(page.text));
  else console.log(`FETCH FAILED ${url}: the page could not be read`);
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
