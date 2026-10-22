import "server-only";
import { TTL, cached, normalizeKeyPart } from "../cache";
import { log } from "../log";
import { isOnDomain, isWebMock } from "./domains";
import { decodeEntities, readTextCapped } from "./fetch-page";

/**
 * Health topic search of MedlinePlus (US National Library of Medicine), a free public web service (ADR-072). It replaces the
 * paid web search of the old vendor: the answer is a few page addresses on medlineplus.gov, which fetch-page then reads.
 * Cached for a day; an identifying User-Agent; a short timeout.
 */

export interface TopicResult {
  title: string;
  url: string;
  snippet: string;
}

const ENDPOINT = "https://wsearch.nlm.nih.gov/ws/query";
const USER_AGENT = "Vyana/1.2 (+https://vyanahealth.app; patient health app; topic search)";
const MAX_BYTES = 1_500_000;

const stripTags = (s: string): string => {
  let out = "";
  let inTag = false;
  for (const ch of s) {
    if (ch === "<") inTag = true;
    else if (ch === ">") inTag = false;
    else if (!inTag) out += ch;
  }
  return out;
};

/** The content of `<content name="...">...</content>` inside one document block, as plain text. */
function contentOf(block: string, name: string): string {
  const open = `<content name="${name}">`;
  const start = block.indexOf(open);
  if (start === -1) return "";
  const end = block.indexOf("</content>", start);
  if (end === -1) return "";
  // The service escapes its markup (&lt;span ...&gt;): decode once, then drop the tags.
  return stripTags(decodeEntities(block.slice(start + open.length, end))).replace(/\s+/g, " ").trim();
}

export function parseTopics(xml: string, limit: number): TopicResult[] {
  const results: TopicResult[] = [];
  let from = 0;
  while (results.length < limit) {
    const start = xml.indexOf("<document ", from);
    if (start === -1) break;
    const end = xml.indexOf("</document>", start);
    if (end === -1) break;
    const block = xml.slice(start, end);
    from = end + 11;
    const q = block.indexOf('url="');
    const urlEnd = q === -1 ? -1 : block.indexOf('"', q + 5);
    const url = q === -1 || urlEnd === -1 ? "" : decodeEntities(block.slice(q + 5, urlEnd));
    if (!url.startsWith("https://") || !isOnDomain(url, "medlineplus.gov")) continue;
    const title = contentOf(block, "title");
    if (!title) continue;
    results.push({ title: title.slice(0, 160), url, snippet: contentOf(block, "FullSummary").slice(0, 300) });
  }
  return results;
}

/** Up to `limit` MedlinePlus health topic pages for a condition or question; an empty list when the service does not answer. */
export async function searchHealthTopics(query: string, limit = 5): Promise<TopicResult[]> {
  const term = query.replace(/\s+/g, " ").trim().slice(0, 120);
  if (term.length < 2) return [];
  if (isWebMock()) {
    const slug = term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "topic";
    return [1, 2, 3].slice(0, limit).map((n) => ({ title: `[mock] ${term} (${n})`, url: `https://medlineplus.gov/${slug}-${n}.html`, snippet: `[mock] Topic ${n} for "${term}".` }));
  }
  try {
    const hit = await cached<TopicResult[]>(`mlp:topics:${normalizeKeyPart(term)}:${limit}`, "mlp_search", TTL.day, async () => {
      const res = await fetch(`${ENDPOINT}?db=healthTopics&retmax=${limit}&term=${encodeURIComponent(term)}`, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/xml,text/xml" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) return null;
      const xml = await readTextCapped(res, MAX_BYTES);
      if (xml === null) return null;
      const topics = parseTopics(xml, limit);
      return topics.length ? topics : null;
    });
    return hit?.value ?? [];
  } catch {
    log({ event: "medlineplus_search_failed" });
    return [];
  }
}
