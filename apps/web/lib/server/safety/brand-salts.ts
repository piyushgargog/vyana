/**
 * Brand → salt for the interaction check (ADR-046): common Indian brands, each checked against its product page.
 * Pure data + lookup, no I/O.
 *
 * Rules for every entry:
 * - Every name in `on_page` appears on `url` (the brand's 1mg product page, composition section). `pnpm verify:brands`
 *   re-fetches the pages and checks this; run it after any change.
 * - `salts` are the main names used by `interactions-table.ts` (aliases map there, e.g. thyroxine → levothyroxine).
 * - `match` = the words the brand is written with; it matches the first words of a prescription line.
 * Changing the list needs a PROGRESS.md entry and a team review (EVALUATION §6 "Interactions table").
 */

import { INTERACTION_TABLE, SALT_ALIASES, expandSalts, normalizeSalt } from "./interactions-table";

export interface BrandSalts {
  brand: string;
  match: string;
  salts: string[];
  on_page: string[];
  url: string;
}

export const BRAND_SALTS: readonly BrandSalts[] = [
  { brand: "Dolo", match: "dolo", salts: ["paracetamol"], on_page: ["paracetamol"], url: "https://www.1mg.com/drugs/dolo-650-tablet-74467" },
  { brand: "Crocin", match: "crocin", salts: ["paracetamol"], on_page: ["paracetamol"], url: "https://www.1mg.com/drugs/crocin-advance-500mg-tablet-600468" },
  { brand: "Calpol", match: "calpol", salts: ["paracetamol"], on_page: ["paracetamol"], url: "https://www.1mg.com/drugs/calpol-500-tablet-878516" },
  { brand: "Ecosprin", match: "ecosprin", salts: ["aspirin"], on_page: ["aspirin"], url: "https://www.1mg.com/drugs/ecosprin-75-tablet-40765" },
  { brand: "Pan", match: "pan", salts: ["pantoprazole"], on_page: ["pantoprazole"], url: "https://www.1mg.com/drugs/pan-40-tablet-325250" },
  { brand: "Pantocid", match: "pantocid", salts: ["pantoprazole"], on_page: ["pantoprazole"], url: "https://www.1mg.com/drugs/pantocid-tablet-332527" },
  { brand: "Omez", match: "omez", salts: ["omeprazole"], on_page: ["omeprazole"], url: "https://www.1mg.com/drugs/omez-capsule-1147617" },
  { brand: "Nexpro", match: "nexpro", salts: ["esomeprazole"], on_page: ["esomeprazole"], url: "https://www.1mg.com/drugs/nexpro-40-tablet-65624" },
  { brand: "Telma", match: "telma", salts: ["telmisartan"], on_page: ["telmisartan"], url: "https://www.1mg.com/drugs/telma-40-tablet-340679" },
  { brand: "Amlong", match: "amlong", salts: ["amlodipine"], on_page: ["amlodipine"], url: "https://www.1mg.com/drugs/amlong-tablet-792551" },
  { brand: "Glycomet", match: "glycomet", salts: ["metformin"], on_page: ["metformin"], url: "https://www.1mg.com/drugs/glycomet-tablet-18033" },
  { brand: "Janumet", match: "janumet", salts: ["sitagliptin","metformin"], on_page: ["sitagliptin","metformin"], url: "https://www.1mg.com/drugs/janumet-50mg-500mg-tablet-173029" },
  { brand: "Galvus Met", match: "galvus met", salts: ["vildagliptin","metformin"], on_page: ["vildagliptin","metformin"], url: "https://www.1mg.com/drugs/galvus-met-50mg-1000mg-tablet-476049" },
  { brand: "Amaryl", match: "amaryl", salts: ["glimepiride"], on_page: ["glimepiride"], url: "https://www.1mg.com/drugs/amaryl-1mg-tablet-12155" },
  { brand: "Atorva", match: "atorva", salts: ["atorvastatin"], on_page: ["atorvastatin"], url: "https://www.1mg.com/drugs/atorva-tablet-506170" },
  { brand: "Storvas", match: "storvas", salts: ["atorvastatin"], on_page: ["atorvastatin"], url: "https://www.1mg.com/drugs/storvas-10-tablet-46532" },
  { brand: "Rosuvas", match: "rosuvas", salts: ["rosuvastatin"], on_page: ["rosuvastatin"], url: "https://www.1mg.com/drugs/rosuvas-10-tablet-113791" },
  { brand: "Clopilet", match: "clopilet", salts: ["clopidogrel"], on_page: ["clopidogrel"], url: "https://www.1mg.com/drugs/clopilet-tablet-328244" },
  { brand: "Deplatt", match: "deplatt", salts: ["clopidogrel"], on_page: ["clopidogrel"], url: "https://www.1mg.com/drugs/deplatt-tablet-329411" },
  { brand: "Thyronorm", match: "thyronorm", salts: ["levothyroxine"], on_page: ["thyroxine"], url: "https://www.1mg.com/drugs/thyronorm-25mcg-tablet-356843" },
  { brand: "Eltroxin", match: "eltroxin", salts: ["levothyroxine"], on_page: ["thyroxine"], url: "https://www.1mg.com/drugs/eltroxin-100mcg-tablet-617041" },
  { brand: "Brufen", match: "brufen", salts: ["ibuprofen"], on_page: ["ibuprofen"], url: "https://www.1mg.com/drugs/brufen-400-tablet-70206" },
  { brand: "Combiflam", match: "combiflam", salts: ["ibuprofen","paracetamol"], on_page: ["ibuprofen","paracetamol"], url: "https://www.1mg.com/drugs/combiflam-tablet-325414" },
  { brand: "Voveran", match: "voveran", salts: ["diclofenac"], on_page: ["diclofenac"], url: "https://www.1mg.com/drugs/voveran-sr-100-tablet-144593" },
  { brand: "Naprosyn", match: "naprosyn", salts: ["naproxen"], on_page: ["naproxen"], url: "https://www.1mg.com/drugs/naprosyn-500-tablet-872331" },
  { brand: "Zerodol", match: "zerodol", salts: ["aceclofenac"], on_page: ["aceclofenac"], url: "https://www.1mg.com/drugs/zerodol-tablet-191575" },
  { brand: "Septran", match: "septran", salts: ["sulfamethoxazole","trimethoprim"], on_page: ["sulfamethoxazole","trimethoprim"], url: "https://www.1mg.com/drugs/septran-ds-800mg-160mg-tablet-175095" },
  { brand: "Bactrim", match: "bactrim", salts: ["sulfamethoxazole","trimethoprim"], on_page: ["sulfamethoxazole","trimethoprim"], url: "https://www.1mg.com/drugs/bactrim-ds-tablet-120037" },
  { brand: "Folitrax", match: "folitrax", salts: ["methotrexate"], on_page: ["methotrexate"], url: "https://www.1mg.com/drugs/folitrax-7.5-tablet-18228" },
  { brand: "Lithosun", match: "lithosun", salts: ["lithium"], on_page: ["lithium"], url: "https://www.1mg.com/drugs/lithosun-300-tablet-16861" },
  { brand: "Warf", match: "warf", salts: ["warfarin"], on_page: ["warfarin"], url: "https://www.1mg.com/drugs/warf-5-tablet-541663" },
  { brand: "Penegra", match: "penegra", salts: ["sildenafil"], on_page: ["sildenafil"], url: "https://www.1mg.com/drugs/penegra-100-tablet-32683" },
  { brand: "Manforce", match: "manforce", salts: ["sildenafil"], on_page: ["sildenafil"], url: "https://www.1mg.com/drugs/manforce-100mg-tablet-125944" },
  { brand: "Monotrate", match: "monotrate", salts: ["isosorbide mononitrate"], on_page: ["isosorbide mononitrate"], url: "https://www.1mg.com/drugs/monotrate-10-tablet-119000" },
  { brand: "Nitrocontin", match: "nitrocontin", salts: ["glyceryl trinitrate"], on_page: ["nitroglycerin"], url: "https://www.1mg.com/drugs/nitrocontin-2.6-tablet-cr-955174" },
  { brand: "Augmentin", match: "augmentin", salts: ["amoxicillin","clavulanic acid"], on_page: ["amoxycillin","clavulanic"], url: "https://www.1mg.com/drugs/augmentin-625-duo-tablet-138629" },
  { brand: "Azithral", match: "azithral", salts: ["azithromycin"], on_page: ["azithromycin"], url: "https://www.1mg.com/drugs/azithral-500-tablet-325616" },
  { brand: "Claribid", match: "claribid", salts: ["clarithromycin"], on_page: ["clarithromycin"], url: "https://www.1mg.com/drugs/claribid-500-tablet-351227" },
  { brand: "Montair", match: "montair", salts: ["montelukast"], on_page: ["montelukast"], url: "https://www.1mg.com/drugs/montair-10-tablet-323982" },
  { brand: "Allegra", match: "allegra", salts: ["fexofenadine"], on_page: ["fexofenadine"], url: "https://www.1mg.com/drugs/allegra-120mg-tablet-68763" },
  { brand: "Cetzine", match: "cetzine", salts: ["cetirizine"], on_page: ["cetirizine"], url: "https://www.1mg.com/drugs/cetzine-tablet-640732" },
  { brand: "Zyloric", match: "zyloric", salts: ["allopurinol"], on_page: ["allopurinol"], url: "https://www.1mg.com/drugs/zyloric-tablet-41865" },
  { brand: "Losar", match: "losar", salts: ["losartan"], on_page: ["losartan"], url: "https://www.1mg.com/drugs/losar-50-tablet-74731" },
  { brand: "Met XL", match: "met xl", salts: ["metoprolol"], on_page: ["metoprolol"], url: "https://www.1mg.com/drugs/met-xl-25-tablet-513453" },];

/** Every salt name the app knows: from the reviewed table, the brand list and the aliases. */
export const KNOWN_SALTS: ReadonlySet<string> = new Set([
  ...INTERACTION_TABLE.flatMap((e) => e.salts),
  ...BRAND_SALTS.flatMap((b) => b.salts),
  ...Object.keys(SALT_ALIASES),
  ...Object.values(SALT_ALIASES),
]);

/** Words on a prescription line that are not part of the name: strengths, forms and release types. */
const FORM_WORDS = new Set(["tablet", "tablets", "tab", "tabs", "capsule", "capsules", "cap", "caps", "syrup", "syp", "injection", "inj", "drops", "suspension", "cream", "gel", "sr", "er", "cr", "od", "ds", "duo", "forte", "plus", "advance"]);
const isStrength = (w: string) => /\d/.test(w) || /^(?:mg|mcg|g|ml|iu|%)$/.test(w);

function words(s: string): string[] {
  return s
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[()[\],+/]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export interface SaltMatch {
  salts: string[];
  via: "bracket" | "brand" | "salt";
}

/**
 * The salts of a prescription line ("Telma (Telmisartan) 40 mg", "Dolo 650", "Metformin 500 mg"), or null when
 * they aren't known. Unknown lines are never guessed: the caller lists them as not checked.
 */
export function saltsFor(name: string): SaltMatch | null {
  const bracket = name.match(/\(([^()]{2,80})\)/);
  if (bracket) {
    const salts = expandSalts(bracket[1].replace(/\d[\d.]*\s*(?:mg|mcg|g|ml|iu)\b/gi, " ")).filter((s) => KNOWN_SALTS.has(s));
    if (salts.length) return { salts, via: "bracket" };
  }

  const w = words(name).filter((x) => !isStrength(x));
  let best: BrandSalts | null = null;
  for (const b of BRAND_SALTS) {
    const m = b.match.split(" ");
    if (m.every((x, i) => w[i] === x) && (!best || m.length > best.match.split(" ").length)) best = b;
  }
  if (best) return { salts: [...best.salts], via: "brand" };

  const plain = w.filter((x) => !FORM_WORDS.has(x)).join(" ");
  const salts = plain ? expandSalts(plain) : [];
  if (salts.length && salts.every((s) => KNOWN_SALTS.has(normalizeSalt(s)))) return { salts, via: "salt" };
  return null;
}
