/**
 * Re-checks the curated interaction table against the live source pages (read with the app's own page reader):
 *   - each entry's quote appears word for word on its first source
 *   - each of its two salts (or an alias) appears on at least one of its sources
 *   - a "major" entry's quote uses wording that justifies it
 * Run after any change to apps/web/lib/server/safety/interactions-table.ts, and before a release.
 *
 *   pnpm verify:interactions
 */
import { fileURLToPath } from "node:url";
import { INTERACTION_TABLE, MAJOR_WORDING, SALT_ALIASES } from "../apps/web/lib/server/safety/interactions-table";
import { evidenceFound, normalizeText } from "../apps/web/lib/server/safety/verbatim";
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

const urls = [...new Set(INTERACTION_TABLE.flatMap((e) => e.sources.map((s) => s.url)))];
const pages = new Map<string, string>();
// Only the hosts of the curated source URLs may be read (the allow-list of this check).
const allowed = [...new Set(urls.map((u) => new URL(u).hostname))];
for (const url of urls) {
  const page = await fetchPage(url, allowed, 400_000);
  if (page) pages.set(url, page.text);
  else console.log(`FETCH FAILED ${url}: the page could not be read`);
}

const namesFor = (salt: string) => [salt, ...Object.entries(SALT_ALIASES).filter(([, main]) => main === salt).map(([alias]) => alias)];
let failures = 0;
for (const e of INTERACTION_TABLE) {
  const problems: string[] = [];
  const first = pages.get(e.sources[0].url);
  if (first === undefined) problems.push(`could not fetch ${e.sources[0].url}`);
  else if (!evidenceFound(first, e.quote)) problems.push("quote not found on the first source");
  for (const salt of e.salts) {
    const onAPage = e.sources.some((s) => {
      const text = normalizeText(pages.get(s.url) ?? "");
      return namesFor(salt).some((n) => text.includes(n));
    });
    if (!onAPage) problems.push(`"${salt}" not found on any source`);
  }
  if (e.severity === "major" && !MAJOR_WORDING.some((w) => e.quote.toLowerCase().includes(w))) problems.push("major without major wording");
  if (problems.length) failures++;
  console.log(`${problems.length ? "FAIL" : "OK  "} ${e.id.padEnd(40)} ${e.severity.padEnd(8)} ${problems.join("; ")}`);
}
console.log(failures ? `\n${failures} of ${INTERACTION_TABLE.length} entries failed` : `\nAll ${INTERACTION_TABLE.length} entries verified against ${pages.size} pages`);
process.exit(failures ? 1 : 0);
