/**
 * Citation filter (PLAN §2A rule 1, DESIGN §10): the app may only show links that our own Search/Fetch
 * calls returned in this request. Any other URL the model writes is removed. Pure functions, no I/O.
 */

/** Same page = same host (without "www.") + path (without trailing slash) + query. Fragment and scheme ignored. */
export function canonicalUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "");
  return `${host}${path}${u.search}`;
}

export function makeAllowList(urls: Iterable<string>): Set<string> {
  const set = new Set<string>();
  for (const url of urls) {
    const c = canonicalUrl(url);
    if (c) set.add(c);
  }
  return set;
}

export function isAllowedUrl(url: string, allowed: Set<string>): boolean {
  const c = canonicalUrl(url);
  return c !== null && allowed.has(c);
}

const TRAILING_PUNCTUATION = new Set([".", ",", ";", ":", "!", "?", "'", '"', ")", "]", "}", ">"]);

/** Finds http(s) URLs in free text. A linear scan (no backtracking regex) so long model output stays cheap. */
export function findUrls(text: string): { start: number; end: number; url: string }[] {
  const found: { start: number; end: number; url: string }[] = [];
  const lower = text.toLowerCase();
  let i = 0;
  while (i < text.length) {
    const http = lower.indexOf("http", i);
    if (http === -1) break;
    const rest = lower.slice(http, http + 8);
    if (!rest.startsWith("http://") && !rest.startsWith("https://")) {
      i = http + 4;
      continue;
    }
    let end = http;
    while (end < text.length && !/[\s<>"'`]/.test(text[end]) && !(text[end] === "(" && end > http)) end++;
    while (end > http && TRAILING_PUNCTUATION.has(text[end - 1])) end--;
    found.push({ start: http, end, url: text.slice(http, end) });
    i = Math.max(end, http + 1);
  }
  return found;
}

/**
 * Removes every URL in `text` that is not in `allowed`. A markdown link `[label](bad-url)` keeps its label as plain text.
 * Returns the cleaned text and the removed URLs (for the `ai_runs` audit).
 */
export function filterCitationsInText(text: string, allowed: Set<string>): { cleaned: string; removed: string[] } {
  const removed: string[] = [];
  let out = "";
  let last = 0;
  for (const { start, end, url } of findUrls(text)) {
    if (isAllowedUrl(url, allowed)) continue;
    removed.push(url);
    const isMarkdownTarget = start >= 2 && text[start - 1] === "(" && text[start - 2] === "]" && text[end] === ")";
    const open = isMarkdownTarget ? text.lastIndexOf("[", start - 2) : -1;
    if (open >= last && !text.slice(open, start - 2).includes("\n")) {
      out += text.slice(last, open) + text.slice(open + 1, start - 2); // "[label](url)" → "label"
      last = end + 1;
    } else {
      out += text.slice(last, start);
      last = end;
    }
  }
  out += text.slice(last);
  return { cleaned: removed.length ? out.replace(/[ \t]{2,}/g, " ") : out, removed };
}

/** Keeps only the sources whose URL is allowed (structured output). */
export function filterSources<T extends { url: string }>(sources: T[], allowed: Set<string>): { kept: T[]; removed: string[] } {
  const kept: T[] = [];
  const removed: string[] = [];
  for (const s of sources) {
    if (isAllowedUrl(s.url, allowed)) kept.push(s);
    else removed.push(s.url);
  }
  return { kept, removed };
}
