/**
 * Layer 1 of the interaction check (PLAN §2A, ADR-033): a small curated table of well-known interactions,
 * matched in code before any web search or model. Pure data + lookup, no I/O.
 *
 * Rules for every entry:
 * - `quote` appears word for word on `sources[0]`, and every salt (or one of its aliases) appears on one of the
 *   sources. `pnpm verify:interactions` re-fetches the pages and checks both; run it after any change.
 * - `severity` follows the source's own wording: `major` only when the quote says avoid / contraindicated /
 *   not usually prescribed / a serious harm; otherwise `moderate`.
 * - `effect` restates the sources in plain words and adds nothing they don't say.
 * Changing the table needs a PROGRESS.md entry and a team review (EVALUATION §6 "Interactions table").
 */

export interface TableSource {
  title: string;
  url: string;
}

export interface TableInteraction {
  id: string;
  /** Two salts, lowercase, by their main name (see SALT_ALIASES). */
  salts: [string, string];
  severity: "major" | "moderate";
  effect: string;
  quote: string;
  sources: TableSource[];
}

/** Shown with every table hit. Never says a combination is safe; never suggests a dose. */
export const TABLE_ADVICE = "Don't stop or change any medicine on your own. Ask your doctor or pharmacist before taking these together.";

/** Other names a salt is sold or written under → its main name. Keys and values are lowercase. */
export const SALT_ALIASES: Record<string, string> = {
  "acetylsalicylic acid": "aspirin",
  acetaminophen: "paracetamol",
  thyroxine: "levothyroxine",
  "thyroxine sodium": "levothyroxine",
  "levothyroxine sodium": "levothyroxine",
  amoxycillin: "amoxicillin",
  "glyceryl trinitrate": "glyceryl trinitrate",
  gtn: "glyceryl trinitrate",
  nitroglycerin: "glyceryl trinitrate",
  nitroglycerine: "glyceryl trinitrate",
  "isosorbide-5-mononitrate": "isosorbide mononitrate",
  "isosorbide 5-mononitrate": "isosorbide mononitrate",
  ismn: "isosorbide mononitrate",
  sulphamethoxazole: "sulfamethoxazole",
  "lithium carbonate": "lithium",
  "lithium citrate": "lithium",
  "methotrexate sodium": "methotrexate",
  "clopidogrel bisulfate": "clopidogrel",
  "clopidogrel bisulphate": "clopidogrel",
  "warfarin sodium": "warfarin",
  "sildenafil citrate": "sildenafil",
  "diclofenac sodium": "diclofenac",
  "diclofenac potassium": "diclofenac",
  "naproxen sodium": "naproxen",
  "atorvastatin calcium": "atorvastatin",
  "esomeprazole magnesium": "esomeprazole",
};

/** A combination product written as one name → its salts. */
export const COMBINATIONS: Record<string, string[]> = {
  "co-trimoxazole": ["sulfamethoxazole", "trimethoprim"],
  cotrimoxazole: ["sulfamethoxazole", "trimethoprim"],
};

const SPS_CLOPIDOGREL: TableSource = {
  title: "Using clopidogrel with proton pump inhibitors (PPIs), NHS Specialist Pharmacy Service",
  url: "https://sps.nhs.uk/articles/using-clopidogrel-with-proton-pump-inhibitors-ppis/",
};
const NHS_CLOPIDOGREL: TableSource = {
  title: "Taking clopidogrel with other medicines and herbal supplements, NHS",
  url: "https://www.nhs.uk/medicines/clopidogrel/taking-clopidogrel-with-other-medicines-and-herbal-supplements/",
};
const SPS_METHOTREXATE: TableSource = {
  title: "Managing interactions with methotrexate, NHS Specialist Pharmacy Service",
  url: "https://sps.nhs.uk/articles/managing-interactions-with-methotrexate/",
};
const NHS_SILDENAFIL: TableSource = {
  title: "Sildenafil (Viagra), NHS",
  url: "https://www.nhs.uk/medicines/sildenafil-viagra/",
};
const LIVERPOOL_SILDENAFIL: TableSource = {
  title: "Sildenafil and tadalafil use in Raynaud's and digital ulcers, Liverpool University Hospitals NHS Foundation Trust",
  url: "https://www.uhliverpool.nhs.uk/patients-and-visitors/patient-leaflets/sildenafil-and-tadalafil-use-raynauds-and-digital-ulcers-pi-3061-v1pdf",
};
const SPS_LITHIUM: TableSource = {
  title: "Lithium monitoring, NHS Specialist Pharmacy Service",
  url: "https://sps.nhs.uk/monitorings/lithium-monitoring/",
};
const NHS_LITHIUM: TableSource = {
  title: "Taking lithium with other medicines and herbal supplements, NHS",
  url: "https://www.nhs.uk/medicines/lithium/taking-lithium-with-other-medicines-and-herbal-supplements/",
};
const MHRA_SIMVASTATIN: TableSource = {
  title: "Simvastatin: updated advice on drug interactions, MHRA Drug Safety Update",
  url: "https://www.gov.uk/drug-safety-update/simvastatin-updated-advice-on-drug-interactions",
};
const NHS_CLARITHROMYCIN: TableSource = {
  title: "Taking clarithromycin with other medicines and herbal supplements, NHS",
  url: "https://www.nhs.uk/medicines/clarithromycin/taking-clarithromycin-with-other-medicines-and-herbal-supplements/",
};
const MEDLINEPLUS_WARFARIN: TableSource = {
  title: "Warfarin, MedlinePlus (U.S. National Library of Medicine)",
  url: "https://medlineplus.gov/druginfo/meds/a682277.html",
};
const NHS_WARFARIN: TableSource = { title: "Warfarin, NHS", url: "https://www.nhs.uk/medicines/warfarin/" };

const CLOPIDOGREL_QUOTE = "Avoid the combined use of clopidogrel with omeprazole or esomeprazole due to a significant interaction.";
const METHOTREXATE_QUOTE = "Taking methotrexate with trimethoprim or co-trimoxazole can increase the risk of bone marrow suppression.";
const SILDENAFIL_QUOTE = "Sildenafil is not usually prescribed together with nitrates.";
const LITHIUM_QUOTE =
  "Maintain adequate fluid intake and avoid dietary changes which reduce or increase sodium intake and avoid taking NSAIDs over the counter.";
const WARFARIN_QUOTE =
  "the following nonprescription or herbal products may interact with warfarin: coenzyme Q10 (Ubidecarenone®), Echinacea, garlic, Ginkgo biloba, ginseng, goldenseal, and St. John's wort; omeprazole; famotidine; aspirin and nonsteroidal anti-inflammatory drugs (NSAIDS) such as ibuprofen or naproxen.";

export const INTERACTION_TABLE: readonly TableInteraction[] = [
  ...(["omeprazole", "esomeprazole"] as const).map((ppi) => ({
    id: `clopidogrel+${ppi}`,
    salts: ["clopidogrel", ppi] as [string, string],
    severity: "major" as const,
    effect: "Omeprazole and esomeprazole may make clopidogrel work less well.",
    quote: CLOPIDOGREL_QUOTE,
    sources: [SPS_CLOPIDOGREL, NHS_CLOPIDOGREL],
  })),
  ...(["trimethoprim", "sulfamethoxazole"] as const).map((abx) => ({
    id: `methotrexate+${abx}`,
    salts: ["methotrexate", abx] as [string, string],
    severity: "major" as const,
    effect:
      abx === "trimethoprim"
        ? "Raises the risk of bone marrow suppression."
        : "Co-trimoxazole (sulfamethoxazole with trimethoprim) raises the risk of bone marrow suppression.",
    quote: METHOTREXATE_QUOTE,
    sources: [SPS_METHOTREXATE],
  })),
  ...(["glyceryl trinitrate", "isosorbide mononitrate"] as const).map((nitrate) => ({
    id: `sildenafil+${nitrate.replace(/ /g, "-")}`,
    salts: ["sildenafil", nitrate] as [string, string],
    severity: "major" as const,
    effect: "Sildenafil is not usually prescribed together with nitrates for chest pain or heart conditions.",
    quote: SILDENAFIL_QUOTE,
    sources: [NHS_SILDENAFIL, LIVERPOOL_SILDENAFIL],
  })),
  ...(["ibuprofen", "diclofenac", "celecoxib"] as const).map((nsaid) => ({
    id: `lithium+${nsaid}`,
    salts: ["lithium", nsaid] as [string, string],
    severity: "major" as const,
    effect: "Anti-inflammatory painkillers (NSAIDs) can change the level of lithium in the blood.",
    quote: LITHIUM_QUOTE,
    sources: [SPS_LITHIUM, NHS_LITHIUM],
  })),
  {
    id: "simvastatin+clarithromycin",
    salts: ["simvastatin", "clarithromycin"],
    severity: "major",
    effect: "The UK medicines regulator lists this combination as contraindicated because it raises the risk of muscle damage (myopathy).",
    quote: "Contraindicated with simvastatin",
    sources: [MHRA_SIMVASTATIN, NHS_CLARITHROMYCIN],
  },
  {
    id: "atorvastatin+clarithromycin",
    salts: ["atorvastatin", "clarithromycin"],
    severity: "moderate",
    effect: "Clarithromycin does not mix well with some statins, including atorvastatin.",
    quote: "a statin medicine to lower your cholesterol, such as simvastatin or atorvastatin",
    sources: [NHS_CLARITHROMYCIN],
  },
  ...(["aspirin", "ibuprofen", "naproxen"] as const).map((nsaid) => ({
    id: `warfarin+${nsaid}`,
    salts: ["warfarin", nsaid] as [string, string],
    severity: "moderate" as const,
    effect: "May interact with warfarin. Tell your doctor before taking them together.",
    quote: WARFARIN_QUOTE,
    sources: [MEDLINEPLUS_WARFARIN, NHS_WARFARIN],
  })),
];

/** Words a `major` entry's quote must contain, so severity can't drift from what the source says. */
export const MAJOR_WORDING = ["avoid", "contraindicated", "not usually prescribed", "bone marrow suppression", "significant"];

/** Lowercase, trim, collapse spaces, map aliases to the main salt name. */
export function normalizeSalt(name: string): string {
  const s = name.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
  return SALT_ALIASES[s] ?? s;
}

/** Splits "Sulfamethoxazole + Trimethoprim" or "co-trimoxazole" into its salts, normalized. */
export function expandSalts(name: string): string[] {
  const n = name.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
  if (COMBINATIONS[n]) return COMBINATIONS[n];
  // Replace separators first, then split: no backtracking-prone regex on user input.
  return n
    .replace(/[+/,&]/g, "|")
    .replace(/\band\b/g, "|")
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(normalizeSalt);
}

export interface TableHit {
  entry: TableInteraction;
  /** The caller's names for the two medicines, in the order the caller gave them. */
  medicines: [string, string];
}

/**
 * Every table interaction between any two of the given medicines (each a salt or a combination of salts).
 * Medicines whose salts are unknown simply match nothing; an empty result is NOT a statement that a combination
 * is safe.
 */
export function lookupInteractions(medicines: string[]): TableHit[] {
  const expanded = medicines.map((m) => ({ name: m, salts: new Set(expandSalts(m)) }));
  const hits: TableHit[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < expanded.length; i++) {
    for (let j = i + 1; j < expanded.length; j++) {
      const a = expanded[i];
      const b = expanded[j];
      for (const entry of INTERACTION_TABLE) {
        const [x, y] = entry.salts;
        const match = (a.salts.has(x) && b.salts.has(y)) || (a.salts.has(y) && b.salts.has(x));
        const key = `${entry.id}|${i}|${j}`;
        if (match && !seen.has(key)) {
          seen.add(key);
          hits.push({ entry, medicines: [a.name, b.name] });
        }
      }
    }
  }
  return hits;
}
