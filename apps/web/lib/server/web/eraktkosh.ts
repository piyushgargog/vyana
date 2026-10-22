import "server-only";
import type { BloodBank, BloodComponent, BloodGroup } from "@vyana/shared";
import { TTL, cached, normalizeKeyPart } from "../cache";
import { log } from "../log";

/**
 * e-RaktKosh (NHM / C-DAC) blood stock, read the way its own public page reads it (ADR-072): three GET calls that answer JSON
 * in about half a second. Probed 21 Oct 2026: no sign-in, no CAPTCHA. We are polite to a government service: every answer is
 * cached (15 minutes for stock, a week for the state and district lists), one request per area and component, a User-Agent that
 * says who we are, and a size cap. A row is only what the source listed at `fetched_at`; the UI says "listed" and "call to confirm".
 */

export const ERAKTKOSH_PAGE = "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt";
const ENDPOINT = "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/nearbyBB.cnt";
const USER_AGENT = "Vyana/1.2 (+https://vyanahealth.app; patient health app; cached lookups of the public stock page)";
const TIMEOUT_MS = 12_000;
const MAX_BYTES = 2_000_000;
const MAX_BANKS_PER_AREA = 15;
const MAX_UNITS = 1000; // a bank listing more is a misread
const WEEK = 7 * 24 * 60 * 60;

/** The codes of the page's own select boxes. */
export const GROUP_CODE: Record<BloodGroup, string> = { "A+": "11", "A-": "12", "B+": "13", "B-": "14", "AB+": "17", "AB-": "18", "O+": "15", "O-": "16" };
/** One search can need more than one code: the page names red cells and platelets in several ways. */
export const COMPONENT_CODES: Record<BloodComponent, { code: string; label: string }[]> = {
  whole_blood: [{ code: "11", label: "Whole Blood" }],
  red_cells: [{ code: "12", label: "Packed Red Blood Cells" }, { code: "28", label: "SAGM Packed Red Blood Cells" }],
  platelets: [{ code: "23", label: "Random Donor Platelets" }, { code: "14", label: "Single Donor Platelet" }],
  plasma: [{ code: "13", label: "Fresh Frozen Plasma" }],
};

// Names people use that the page lists under another name.
const ALIASES: Record<string, string> = {
  gurugram: "gurgaon",
  bengaluru: "bangalore urban",
  bangalore: "bangalore urban",
  mysuru: "mysore",
  prayagraj: "allahabad",
  noida: "gautam buddha nagar",
  "greater noida": "gautam buddha nagar",
  kochi: "ernakulam",
  cochin: "ernakulam",
  trivandrum: "thiruvananthapuram",
  vizag: "visakhapatnam",
  secunderabad: "hyderabad",
  "pimpri-chinchwad": "pune",
  pimpri: "pune",
  kanpur: "kanpur nagar",
  varanasi: "varanasi",
  calcutta: "kolkata",
  madras: "chennai",
  bombay: "mumbai",
};
const WHOLE_STATE = new Set(["delhi", "new delhi", "chandigarh", "goa", "puducherry"]);

export interface Area {
  label: string;
  stateCode: string;
  districtCode: string; // "-1" = the whole state or union territory
  /** When the district could not be matched, only rows whose address holds this text are kept. */
  mustContain: string | null;
}

interface DistrictEntry {
  state: string;
  stateCode: string;
  district: string;
  districtCode: string;
}

// ---------------------------------------------------------------- http

async function getJson(query: string): Promise<unknown> {
  const res = await fetch(`${ENDPOINT}?${query}`, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`eraktkosh_http_${res.status}`);
  const text = await res.text();
  if (text.length > MAX_BYTES) throw new Error("eraktkosh_too_large");
  return JSON.parse(text);
}

// ---------------------------------------------------------------- areas

/** Every district of every state, from the page's own lists; cached for a week. */
export async function districtIndex(): Promise<DistrictEntry[]> {
  const hit = await cached<DistrictEntry[]>("erk:districts:v1", "erk_index", WEEK, async () => {
    const states = (await getJson("hmode=GETSTATELIST&statetype=")) as { value: string; label: string }[];
    const out: DistrictEntry[] = [];
    for (let i = 0; i < states.length; i += 6) {
      const batch = await Promise.all(
        states.slice(i, i + 6).map(async (s) => {
          const body = (await getJson(`hmode=GETDISTRICTLIST&selectedStateCode=${encodeURIComponent(s.value)}`)) as { records?: { id: string; value: string }[] };
          return (body.records ?? []).map((d) => ({ state: s.label, stateCode: s.value, district: d.id.trim(), districtCode: d.value }));
        }),
      );
      out.push(...batch.flat());
    }
    return out.length ? out : null;
  });
  return hit?.value ?? [];
}

const norm = (s: string) => normalizeKeyPart(s).replace(/[^a-z0-9 -]/g, "");

/** The city the person typed → up to three areas of the source (a district, or a whole union territory). */
export async function resolveAreas(city: string): Promise<Area[]> {
  const key = norm(city);
  if (key.length < 2) return [];
  const index = await districtIndex();
  if (WHOLE_STATE.has(key)) {
    const state = index.find((d) => norm(d.state) === key.replace("new delhi", "delhi"));
    return state ? [{ label: city, stateCode: state.stateCode, districtCode: "-1", mustContain: null }] : [];
  }
  const want = ALIASES[key] ?? key;
  const exact = index.filter((d) => norm(d.district) === want);
  const starts = exact.length ? exact : index.filter((d) => norm(d.district).startsWith(want));
  const found = starts.length ? starts : want.length >= 4 ? index.filter((d) => norm(d.district).includes(want)) : [];
  if (found.length) return found.slice(0, 3).map((d) => ({ label: `${d.district}, ${d.state}`, stateCode: d.stateCode, districtCode: d.districtCode, mustContain: null }));
  const state = index.find((d) => norm(d.state) === want);
  return state ? [{ label: state.state, stateCode: state.stateCode, districtCode: "-1", mustContain: null }] : [];
}

// ---------------------------------------------------------------- rows

const cleanText = (html: string): string => {
  let out = "";
  let inTag = false;
  for (const ch of html) {
    if (ch === "<") inTag = true;
    else if (ch === ">") inTag = false;
    else if (!inTag) out += ch;
  }
  // `&amp;` is decoded last, so "&amp;lt;" ends as the text "&lt;" and is not decoded twice.
  return out
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
};

/**
 * "Available, B-Ve:16" → 16. Anything else (for example "Not Available") has no count. We always ask for one blood group, so the cell
 * holds one count; a cell with several groups cannot be attributed to ours and gives no number (never a guess).
 */
export function unitsFromCell(cell: string): number | null {
  const text = cleanText(cell);
  if (!/^available/i.test(text)) return null;
  const counts = [...text.matchAll(/:\s*(\d{1,6})\b/g)];
  if (counts.length !== 1 || !counts[0]?.[1]) return null;
  const n = Number(counts[0][1]);
  return Number.isInteger(n) && n > 0 && n <= MAX_UNITS ? n : null;
}

function phoneOf(part: string): string | null {
  const m = /Phone:\s*([0-9+()\- ]{6,20})/.exec(part);
  const phone = m?.[1]?.trim().replace(/\s+/g, " ");
  return phone && /\d{6}/.test(phone.replace(/\D/g, "")) ? phone : null;
}

/** One table row of the source → a bank with its stock, or null for a row without a stock number. */
export function parseRow(row: unknown, area: Area, component: string, fetchedAt: string): BloodBank | null {
  if (!Array.isArray(row) || row.length < 5) return null;
  const [, info, , stock, updated] = row as unknown[];
  if (typeof info !== "string" || typeof stock !== "string") return null;
  const units = unitsFromCell(stock);
  if (units === null) return null;
  const parts = info.split(/<br\s*\/?>/i).map(cleanText);
  const address = parts[1] && parts[1] !== "-" ? parts[1] : null;
  let name = (parts[0] ?? "").trim();
  if (!name || name === "-") name = (address ?? "").split(",")[0]?.trim() ?? "";
  if (!name || name === "-") return null;
  if (area.mustContain && !`${name} ${address ?? ""}`.toLowerCase().includes(area.mustContain)) return null;
  const when = typeof updated === "string" ? cleanText(updated) : "";
  return {
    name: name.slice(0, 120),
    address: address ? address.slice(0, 200) : null,
    city: area.label,
    phone: phoneOf(parts[2] ?? ""),
    units,
    component,
    source_url: ERAKTKOSH_PAGE,
    fetched_at: fetchedAt,
    last_updated_text: when ? when.slice(0, 40) : null,
    // The count was read from this very response (no model in between), so the row holds the bank's name and the number as listed.
    verified: true,
  };
}

// ---------------------------------------------------------------- stock

export type AreaStatus = "ok" | "not_found" | "error";
export interface AreaResult {
  area: string;
  status: AreaStatus;
  banks: BloodBank[];
}

async function stockFor(area: Area, group: BloodGroup, c: { code: string; label: string }): Promise<BloodBank[]> {
  const q = `hmode=GETNEARBYSTOCKDETAILS&stateCode=${encodeURIComponent(area.stateCode)}&districtCode=${encodeURIComponent(area.districtCode)}&bloodGroup=${GROUP_CODE[group]}&bloodComponent=${c.code}&lang=0`;
  const hit = await cached<{ rows: unknown[]; at: string }>(`erk:stock:${q}`, "erk_stock", TTL.quarter, async () => {
    const body = (await getJson(q)) as { data?: unknown[] };
    return { rows: Array.isArray(body.data) ? body.data : [], at: new Date().toISOString() };
  });
  if (!hit) return [];
  return hit.value.rows.map((r) => parseRow(r, area, c.label, hit.value.at)).filter((b): b is BloodBank => b !== null);
}

/** Stock for one area: every code of the component, merged, most units first. A failed call is an error, an empty answer is not_found. */
export async function searchArea(area: Area, group: BloodGroup, component: BloodComponent): Promise<AreaResult> {
  try {
    const lists = await Promise.all(COMPONENT_CODES[component].map((c) => stockFor(area, group, c)));
    const seen = new Set<string>();
    const banks = lists
      .flat()
      .filter((b) => {
        const k = `${b.name.toLowerCase()}|${b.component}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      })
      .sort((a, b) => (b.units ?? 0) - (a.units ?? 0))
      .slice(0, MAX_BANKS_PER_AREA);
    return { area: area.label, status: banks.length ? "ok" : "not_found", banks };
  } catch (err) {
    log({ event: "eraktkosh_error", area: area.label, error: err instanceof Error ? err.message.slice(0, 80) : "unknown" });
    return { area: area.label, status: "error", banks: [] };
  }
}
