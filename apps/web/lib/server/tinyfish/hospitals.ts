import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { EmergencyNearbyRes, Hospital, HospitalInfoRes, PmjayHospitalsRes, SourceLink } from "@vyana/shared";
import { runAi } from "../ai";
import { TTL, cached } from "../cache";
import { notFound } from "../errors";
import { reverseGeocode } from "../geo";
import { log } from "../log";
import {
  NEARBY_PROMPT_VERSION,
  NEARBY_SYSTEM,
  OPD_PROMPT_VERSION,
  OPD_SYSTEM,
  PMJAY_PROMPT_VERSION,
  PMJAY_SYSTEM,
  nearbyPrompt,
  opdPrompt,
  pmjayPrompt,
  type PromptPage,
} from "../prompts/hospitals";
import { evidenceFound, normalizeText } from "../safety/verbatim";
import { supabaseAdmin } from "../supabase-admin";
import { type CallCounter, fetchPages, search } from "./client";
import { registerMockPage } from "./fixtures";

/**
 * Hospitals from the live web (SPEC §5, §16). The model only reads the fetched pages; every value it returns is
 * checked against the page it says it came from, and anything not on the page is dropped or nulled (§2A rule 1).
 */

const PAGE_CHARS = 12_000;
const isWebMock = () => process.env.TINYFISH_MOCK === "1";

interface Page extends PromptPage {
  title: string;
}

async function readPages(urls: string[], purpose: string, counter: CallCounter): Promise<Page[]> {
  if (!urls.length) return [];
  const res = await fetchPages({ urls, purpose }, { counter });
  return res.results
    .filter((r) => (r.text ?? "").trim().length > 0)
    .map((r) => ({ url: r.url, title: r.title ?? r.url, text: (r.text ?? "").slice(0, PAGE_CHARS) }));
}

const sourcesOf = (pages: Page[]): SourceLink[] => pages.map((p) => ({ title: p.title, url: p.url }));

// ---------------------------------------------------------------- checks

/** The phone's digits appear on the page, ignoring spaces, dashes, dots, brackets and an optional +91 / 0 prefix. */
export function phoneOnPage(pageText: string, phone: string | null | undefined): boolean {
  if (!phone) return false;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 8) return false;
  const pageDigits = pageText.replace(/[\s\-().+/]/g, "");
  const variants = new Set([digits]);
  if (digits.startsWith("91") && digits.length === 12) variants.add(digits.slice(2));
  if (digits.startsWith("0")) variants.add(digits.slice(1));
  return [...variants].some((v) => pageDigits.includes(v));
}

const EMERGENCY_WORDS = ["emergency", "casualty", "trauma"];
const ICU_WORDS = ["icu", "intensive care", "critical care"];
const mentions = (pageText: string, words: string[]) => {
  const t = ` ${normalizeText(pageText)} `;
  return words.some((w) => t.includes(w));
};

export function mapsUrl(name: string, address: string | null): string {
  const query = address ? `${name}, ${address}` : name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

// ---------------------------------------------------------------- nearby (SPEC §5)

export const NearbyLlm = z.object({
  hospitals: z.array(
    z.object({
      name: z.string(),
      address: z.string().nullable(),
      phone: z.string().nullable(),
      has_emergency: z.boolean().nullable(),
      has_icu: z.boolean().nullable(),
      page: z.number().int(),
    }),
  ),
});
type NearbyLlm = z.infer<typeof NearbyLlm>;

/** Keeps only what the pages show. Returns the hospitals and how many the model gave that didn't survive. */
export function verifyNearby(out: NearbyLlm, pages: Page[]): { hospitals: Hospital[]; dropped: number } {
  const hospitals: Hospital[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const h of out.hospitals) {
    const page = pages[h.page];
    const name = h.name.trim();
    const key = normalizeText(name);
    if (!page || !name || !evidenceFound(page.text, name) || seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);
    const address = h.address && evidenceFound(page.text, h.address) ? h.address.trim() : null;
    hospitals.push({
      name,
      address,
      phone: phoneOnPage(page.text, h.phone) ? (h.phone as string).trim() : null,
      has_emergency: mentions(page.text, EMERGENCY_WORDS) ? h.has_emergency : null,
      has_icu: mentions(page.text, ICU_WORDS) ? h.has_icu : null,
      maps_url: mapsUrl(name, address),
      source_url: page.url,
    });
    if (hospitals.length === 5) break;
  }
  return { hospitals, dropped };
}

const MOCK_NEARBY: NearbyLlm = {
  hospitals: [
    { name: "[mock] City Emergency Hospital", address: "[mock] 1 Main Road, Delhi", phone: "011-2345 6789", has_emergency: true, has_icu: true, page: 0 },
  ],
};
const MOCK_NEARBY_PAGE = "# [mock] City Emergency Hospital\n\n[mock] 1 Main Road, Delhi. Phone: 011-2345 6789. 24x7 Emergency and ICU.";

export async function findNearbyHospitals(
  lat: number,
  lng: number,
  ctx: { userId: string; counter: CallCounter },
): Promise<EmergencyNearbyRes> {
  const key = `nearby:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  let area: string | null = null;
  const hit = await cached<{ area: string | null; hospitals: Hospital[] }>(key, "nearby", 6 * TTL.hour, async () => {
    area = await reverseGeocode(lat, lng);
    const where = area ?? `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const found = await search({ query: `24x7 emergency hospital with ICU near ${where}`, location: "IN" }, { counter: ctx.counter });
    const urls = [...new Set(found.results.map((r) => r.url))].slice(0, 5);
    if (isWebMock() && urls[0]) registerMockPage(urls[0], MOCK_NEARBY_PAGE);
    const pages = await readPages(urls, "Find hospitals with emergency care, their address and phone", ctx.counter);
    if (!pages.length) return null;
    const { object } = await runAi({
      feature: "hospitals_nearby",
      kind: "text",
      schema: NearbyLlm,
      system: NEARBY_SYSTEM,
      prompt: nearbyPrompt(where, pages),
      promptVersion: NEARBY_PROMPT_VERSION,
      sources: sourcesOf(pages),
      userId: ctx.userId,
      mock: MOCK_NEARBY,
      statusOf: (o) => (verifyNearby(o, pages).dropped > 0 ? "needs_review" : "ok"),
    });
    const { hospitals } = verifyNearby(object, pages);
    return hospitals.length ? { area, hospitals } : null;
  });
  if (hit) return { area: hit.value.area, hospitals: hit.value.hospitals, cached: hit.cached };
  return { area, hospitals: [], cached: false };
}

// ---------------------------------------------------------------- OPD info (SPEC §16)

export const OpdLlm = z.object({
  rows: z.array(z.object({ department: z.string(), days: z.string(), timings: z.string(), page: z.number().int() })),
  notes: z.string().nullable(),
  notes_page: z.number().int().nullable(),
});
type OpdLlm = z.infer<typeof OpdLlm>;

export function verifyOpd(out: OpdLlm, pages: Page[]) {
  const opd: HospitalInfoRes["opd"] = [];
  let sourceUrl: string | null = null;
  let dropped = 0;
  for (const row of out.rows) {
    const page = pages[row.page];
    if (!page || !evidenceFound(page.text, row.timings) || !evidenceFound(page.text, row.department)) {
      dropped++;
      continue;
    }
    sourceUrl ??= page.url;
    opd.push({ department: row.department.trim(), days: row.days.trim(), timings: row.timings.trim() });
  }
  const notesPage = out.notes_page === null ? undefined : pages[out.notes_page];
  const notes = out.notes && notesPage && evidenceFound(notesPage.text, out.notes) ? out.notes.trim() : null;
  return { opd, notes, sourceUrl, dropped };
}

const OPD_TTL_MS = 7 * TTL.day * 1000;
const MOCK_OPD: OpdLlm = {
  rows: [{ department: "General Medicine", days: "Monday to Saturday", timings: "9:00 AM to 1:00 PM", page: 0 }],
  notes: null,
  notes_page: null,
};
const MOCK_OPD_PAGE = "# [mock] OPD timings\n\nGeneral Medicine: Monday to Saturday, 9:00 AM to 1:00 PM.";

const StoredOpd = z.object({
  opd: z.array(z.object({ department: z.string(), days: z.string(), timings: z.string() })),
  notes: z.string().nullable(),
  source_url: z.string().nullable(),
});

function hostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export async function hospitalOpdInfo(
  hospitalId: string,
  sb: SupabaseClient,
  ctx: { userId: string; counter: CallCounter },
): Promise<HospitalInfoRes> {
  const { data, error } = await sb
    .from("hospitals")
    .select("id, name, website, opd_info, opd_info_fetched_at")
    .eq("id", hospitalId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Hospital not found.");
  const hospital = data as { id: string; name: string; website: string | null; opd_info: unknown; opd_info_fetched_at: string | null };

  const stored = StoredOpd.safeParse(hospital.opd_info);
  const fetchedAt = hospital.opd_info_fetched_at ? Date.parse(hospital.opd_info_fetched_at) : NaN;
  if (stored.success && Date.now() - fetchedAt < OPD_TTL_MS) {
    return { hospital_id: hospital.id, ...stored.data, fetched_at: hospital.opd_info_fetched_at as string, cached: true };
  }

  const query = `${hospital.name} OPD timings departments`;
  const host = hostOf(hospital.website);
  let results = host ? (await search({ query, include_domains: [host], location: "IN" }, { counter: ctx.counter })).results : [];
  if (!results.length) results = (await search({ query, location: "IN" }, { counter: ctx.counter })).results;
  const urls = [...new Set(results.map((r) => r.url))].slice(0, 2);
  if (isWebMock() && urls[0]) registerMockPage(urls[0], MOCK_OPD_PAGE);
  const pages = await readPages(urls, `Find the OPD timings of ${hospital.name}`, ctx.counter);

  const now = new Date().toISOString();
  const empty: HospitalInfoRes = { hospital_id: hospital.id, opd: [], notes: null, source_url: null, fetched_at: now, cached: false };
  if (!pages.length) return empty;

  const { object } = await runAi({
    feature: "hospital_opd",
    kind: "text",
    schema: OpdLlm,
    system: OPD_SYSTEM,
    prompt: opdPrompt(hospital.name, pages),
    promptVersion: OPD_PROMPT_VERSION,
    sources: sourcesOf(pages),
    userId: ctx.userId,
    mock: MOCK_OPD,
    statusOf: (o) => (verifyOpd(o, pages).dropped > 0 ? "needs_review" : "ok"),
  });
  const { opd, notes, sourceUrl } = verifyOpd(object, pages);
  if (!opd.length) return empty;

  const { error: saveError } = await supabaseAdmin()
    .from("hospitals")
    .update({ opd_info: { opd, notes, source_url: sourceUrl }, opd_info_fetched_at: now })
    .eq("id", hospital.id);
  if (saveError) log({ event: "opd_info_save_failed" });
  return { hospital_id: hospital.id, opd, notes, source_url: sourceUrl, fetched_at: now, cached: false };
}

// ---------------------------------------------------------------- PM-JAY (SPEC §17, ADR-048)

/** Government pages only: a third party's list can't say a hospital is empanelled (ADR-048). */
export function isGovUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (u.protocol === "https:" || u.protocol === "http:") && (host.endsWith(".gov.in") || host.endsWith(".nic.in"));
  } catch {
    return false;
  }
}

export const PmjayLlm = z.object({
  hospitals: z.array(z.object({ name: z.string(), address: z.string().nullable(), specialities: z.array(z.string()), page: z.number().int() })),
});
type PmjayLlm = z.infer<typeof PmjayLlm>;
export type PmjayHospital = PmjayHospitalsRes["hospitals"][number];

export function verifyPmjay(out: PmjayLlm, pages: Page[]): { hospitals: PmjayHospital[]; dropped: number } {
  const hospitals: PmjayHospital[] = [];
  const seen = new Set<string>();
  let dropped = 0;
  for (const h of out.hospitals) {
    const page = pages[h.page];
    const name = h.name.trim();
    const key = normalizeText(name);
    if (!page || !isGovUrl(page.url) || !name || !evidenceFound(page.text, name) || seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);
    hospitals.push({
      name,
      address: h.address && evidenceFound(page.text, h.address) ? h.address.trim() : null,
      specialities: h.specialities.map((s) => s.trim()).filter((s) => {
        const ok = Boolean(s) && evidenceFound(page.text, s);
        if (!ok) dropped++;
        return ok;
      }),
      source_url: page.url,
    });
    if (hospitals.length === 10) break;
  }
  return { hospitals, dropped };
}

const MOCK_PMJAY_URL_HOST = "health.mock.gov.in";
const MOCK_PMJAY_PAGE = "# [mock] PM-JAY empanelled hospitals\n\n[mock] Sanjeevani Hospital, [mock] 12 Ring Road, Delhi. Specialities: General Medicine, Cardiology.";
const MOCK_PMJAY: PmjayLlm = {
  hospitals: [{ name: "[mock] Sanjeevani Hospital", address: "[mock] 12 Ring Road, Delhi", specialities: ["General Medicine", "Cardiology", "Oncology"], page: 0 }],
};

export async function findPmjayHospitals(lat: number, lng: number, ctx: { userId: string; counter: CallCounter }): Promise<PmjayHospitalsRes> {
  const key = `pmjay:${lat.toFixed(2)}:${lng.toFixed(2)}`;
  let area: string | null = null;
  const hit = await cached<{ area: string | null; hospitals: PmjayHospital[] }>(key, "pmjay", 7 * TTL.day, async () => {
    area = await reverseGeocode(lat, lng);
    const where = area ?? `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const found = await search({ query: `Ayushman Bharat PM-JAY empanelled hospitals ${where}`, location: "IN" }, { counter: ctx.counter });
    let urls = [...new Set(found.results.map((r) => r.url))].filter(isGovUrl).slice(0, 3);
    if (isWebMock()) {
      urls = [`https://${MOCK_PMJAY_URL_HOST}/pmjay-hospitals`];
      registerMockPage(urls[0], MOCK_PMJAY_PAGE);
    }
    const pages = await readPages(urls, "Find hospitals empanelled under PM-JAY, with address and specialities", ctx.counter);
    if (!pages.length) return null;
    const { object } = await runAi({
      feature: "pmjay_hospitals",
      kind: "text",
      schema: PmjayLlm,
      system: PMJAY_SYSTEM,
      prompt: pmjayPrompt(where, pages),
      promptVersion: PMJAY_PROMPT_VERSION,
      sources: sourcesOf(pages),
      userId: ctx.userId,
      mock: MOCK_PMJAY,
      statusOf: (o) => (verifyPmjay(o, pages).dropped > 0 ? "needs_review" : "ok"),
    });
    const { hospitals } = verifyPmjay(object, pages);
    return hospitals.length ? { area, hospitals } : null;
  });
  if (hit) return { area: hit.value.area, hospitals: hit.value.hospitals, cached: hit.cached };
  return { area, hospitals: [], cached: false };
}
