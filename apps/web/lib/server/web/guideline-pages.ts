import "server-only";
import { TTL, cached, normalizeKeyPart } from "../cache";
import { CARE_PLAN_DOMAINS, isOnAnyDomain, isOnDomain, isWebMock } from "./domains";
import { fetchPage, registerMockPage } from "./fetch-page";
import { searchHealthTopics } from "./medlineplus";

/**
 * Trusted guideline pages for a condition (SPEC section 13, ADR-072): MedlinePlus finds the health topic pages for the
 * condition name, our own `fetchPage` reads them from the allow-listed sites. Public data, so cached for a day per condition.
 * Kept apart from `care-plan.ts` so scripts can use it without loading the shared React package.
 */

export { CARE_PLAN_DOMAINS };

const MAX_PAGES = 3;
const PAGE_CHARS = 12_000;
const MIN_PAGE_CHARS = 200;

export interface Page {
  title: string;
  url: string;
  text: string;
}

/**
 * A MedlinePlus topic page is an "On this page" menu, the summary, then lists of links to other sites. Only the summary is
 * guidance, and the model sees just the start of each page, so the menu and the link lists must not use up its share.
 */
export function medlineBody(text: string): string {
  const start = text.indexOf("\n## Summary");
  const body = start === -1 ? text : text.slice(start + 1);
  const end = body.indexOf("\n## Start Here");
  return end === -1 ? body : body.slice(0, end);
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

/** Up to 3 trusted guideline pages for a condition; an empty list when none could be found or read (the caller says "ask your doctor"). */
export async function guidelinePages(condition: string): Promise<Page[]> {
  const hit = await cached<Page[]>(`careplan_pages:v3:${normalizeKeyPart(condition)}`, "care_plan_pages", TTL.day, async () => {
    const topics = await searchHealthTopics(condition, MAX_PAGES);
    const urls = topics.map((t) => t.url).filter((u) => isOnAnyDomain(u, CARE_PLAN_DOMAINS)).slice(0, MAX_PAGES);
    if (!urls.length) return null;
    if (isWebMock()) for (const u of urls) registerMockPage(u, MOCK_PAGE);
    const fetched = await Promise.all(urls.map((u) => fetchPage(u, CARE_PLAN_DOMAINS, PAGE_CHARS)));
    const pages = fetched
      .filter((p): p is NonNullable<typeof p> => p !== null && p.text.length >= MIN_PAGE_CHARS)
      .map((p) => ({ title: p.title, url: p.url, text: isOnDomain(p.url, "medlineplus.gov") ? medlineBody(p.text) : p.text }))
      .filter((p) => p.text.length >= MIN_PAGE_CHARS);
    return pages.length ? pages : null;
  });
  return hit?.value ?? [];
}
