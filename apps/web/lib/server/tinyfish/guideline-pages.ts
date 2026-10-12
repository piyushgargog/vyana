import "server-only";
import { TTL, cached, normalizeKeyPart } from "../cache";
import { fetchPages, search, type CallCounter } from "./client";
import { registerMockPage } from "./fixtures";
import { isOnDomain } from "./sources";

/**
 * Trusted guideline pages for a condition (SPEC §13). Kept apart from `care-plan.ts` so scripts (prewarm) can use it
 * without loading the shared React package.
 */

export const CARE_PLAN_DOMAINS = ["mohfw.gov.in", "icmr.gov.in", "who.int", "nhs.uk", "medlineplus.gov", "nhm.gov.in"];
const MAX_PAGES = 3;
const PAGE_CHARS = 12_000;
const MIN_PAGE_CHARS = 200;

export interface Page {
  title: string;
  url: string;
  text: string;
}

const MOCK_PAGE = [
  "# [mock] Living well with a long-term condition",
  "Regular physical activity, such as brisk walking for 30 minutes a day, helps you stay healthy.",
  "Stop smoking and limit alcohol.",
  "Eat plenty of vegetables, whole grains such as oats and brown rice, and pulses such as dal.",
  "Limit foods high in sugar and salt, such as sweets and fried snacks.",
  "Get urgent medical help if you feel very unwell.",
  "Have your blood sugar (HbA1c) checked every 3 months.",
].join("\n\n");

/** Up to 3 trusted guideline pages for a condition. Public data, so cached for a day per condition. */
export async function guidelinePages(condition: string, counter: CallCounter): Promise<Page[]> {
  const hit = await cached<Page[]>(`careplan_pages:${normalizeKeyPart(condition)}`, "care_plan_pages", TTL.day, async () => {
    const res = await search({ query: `${condition} patient guidelines diet lifestyle`, include_domains: CARE_PLAN_DOMAINS }, { counter });
    const urls = res.results
      .map((r) => r.url)
      .filter((u) => CARE_PLAN_DOMAINS.some((d) => isOnDomain(u, d)))
      .slice(0, MAX_PAGES);
    if (!urls.length) return null;
    if (process.env.TINYFISH_MOCK === "1") for (const u of urls) registerMockPage(u, MOCK_PAGE);
    const fetched = await fetchPages({ urls, format: "markdown" }, { counter });
    const pages = fetched.results
      .filter((r) => (r.text ?? "").length >= MIN_PAGE_CHARS && CARE_PLAN_DOMAINS.some((d) => isOnDomain(r.final_url ?? r.url, d)))
      .map((r) => ({ title: r.title ?? r.url, url: r.final_url ?? r.url, text: (r.text as string).slice(0, PAGE_CHARS) }));
    return pages.length ? pages : null;
  });
  return hit?.value ?? [];
}
