/**
 * Live probe of the blood stock reader (ADR-072): one real search against the public e-RaktKosh service, with timings.
 * Reads a public government service, so run it by hand and rarely (answers are cached for 15 minutes in the app, not here).
 *
 *   pnpm exec tsx --conditions=react-server scripts/probe-eraktkosh.mts "Delhi" B- whole_blood
 *
 * Needs the Supabase admin env of apps/web/.env.local because the reader caches through `web_cache`.
 */
// Only the reader is imported: the job layer pulls in the shared React package, which a plain script cannot load.
import { resolveAreas, searchArea } from "../apps/web/lib/server/web/eraktkosh";

const [city = "Delhi", group = "B-", component = "whole_blood"] = process.argv.slice(2);
// the script is run by hand: the group and component are used as typed (B-, whole_blood, red_cells, platelets, plasma)
const req = { blood_group: group as never, component: component as never, city };

const t0 = Date.now();
const areas = await resolveAreas(req.city);
console.log(`areas (${Date.now() - t0} ms):`, areas.map((a) => `${a.label} [${a.stateCode}/${a.districtCode}]`).join(" | ") || "none");

const t1 = Date.now();
const results = await Promise.all(areas.map((a) => searchArea(a, req.blood_group, req.component)));
const out = { sources: results.map((r) => ({ area: r.area, status: r.status })), banks: results.flatMap((r) => r.banks).sort((a, b) => (b.units ?? 0) - (a.units ?? 0)) };
console.log(`stock (${Date.now() - t1} ms):`, out.sources.map((s) => `${s.area}=${s.status}`).join(", "));
for (const b of out.banks.slice(0, 8)) console.log(`${String(b.units).padStart(4)}  ${b.name}  ${b.phone ?? "no phone"}  ${b.last_updated_text ?? "no time"}`);
console.log(`${out.banks.length} banks listed. Call to confirm before anyone travels.`);
