import "server-only";
import { TTL, cached, sha1 } from "../cache";
import { log } from "../log";
import { isOnAnyDomain, isWebMock } from "./domains";

/**
 * Reads one public web page as text (ADR-072). Only hosts on the caller's allow-list, https only, every redirect checked
 * against the same list, a timeout, a size cap, an identifying User-Agent, and a one day cache (public pages, never patient
 * data). The text is data for the model to quote, never instructions.
 */

export interface FetchedPage {
  url: string;
  title: string;
  text: string;
}

interface CachedPage extends FetchedPage {
  /** The address the text really came from, after redirects. */
  finalUrl: string;
}

const USER_AGENT = "Vyana/1.2 (+https://vyanahealth.app; patient health app; reads public health pages)";
const TIMEOUT_MS = 15_000;
const MAX_BYTES = 3_000_000;
const MAX_REDIRECTS = 4;
const MIN_TEXT_CHARS = 200;

// Pages that mock mode returns for a URL (tests and local development).
const mockPages = new Map<string, string>();
export const registerMockPage = (url: string, text: string): void => void mockPages.set(url, text);

// ---------------------------------------------------------------- html to text

const DROP = new Set(["script", "style", "noscript", "svg", "nav", "header", "footer", "form", "aside", "iframe", "button", "select", "template"]);
const BLOCK = new Set(["p", "div", "section", "article", "main", "br", "tr", "ul", "ol", "table", "blockquote", "dl", "dt", "dd", "h1", "h2", "h3", "h4", "h5", "h6", "li"]);

export function decodeEntities(s: string): string {
  // `&amp;` last, so "&amp;lt;" ends as the text "&lt;" and is not decoded twice.
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

const tidy = (s: string) => decodeEntities(s).replace(/[ \t\r\f\v]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

/** A small tokenizer (no backtracking regexes on remote text): drops page chrome, keeps headings as "# " and list items as "- ". */
export function htmlToText(html: string): { title: string; text: string } {
  const lower = html.toLowerCase();
  let title = "";
  let out = "";
  let skip = 0;
  let inTitle = false;
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt === -1) {
      if (!skip) out += html.slice(i);
      break;
    }
    if (!skip && lt > i) {
      const chunk = html.slice(i, lt);
      if (inTitle) title += chunk;
      else out += chunk;
    }
    if (html.startsWith("<!--", lt)) {
      const end = html.indexOf("-->", lt + 4);
      i = end === -1 ? html.length : end + 3;
      continue;
    }
    const gt = html.indexOf(">", lt + 1);
    if (gt === -1) break;
    const raw = html.slice(lt + 1, gt).trim();
    const closing = raw.startsWith("/");
    let name = "";
    for (const ch of closing ? raw.slice(1) : raw) {
      if (/[a-zA-Z0-9]/.test(ch)) name += ch.toLowerCase();
      else break;
    }
    if (name === "title") inTitle = !closing;
    if (!closing && (name === "script" || name === "style") && !raw.endsWith("/")) {
      // Raw text: a "<" or ">" inside it is code, not markup. Jump to the closing tag (or to the end when it never closes).
      const close = lower.indexOf(`</${name}`, gt + 1);
      const after = close === -1 ? -1 : lower.indexOf(">", close);
      i = close === -1 || after === -1 ? html.length : after + 1;
      continue;
    }
    if (DROP.has(name)) {
      if (!closing && !raw.endsWith("/")) skip++;
      else if (closing && skip > 0) skip--;
    } else if (!skip) {
      if (!closing && /^h[1-6]$/.test(name)) out += `\n\n${"#".repeat(Number(name[1]))} `;
      else if (!closing && name === "li") out += "\n- ";
      else if (BLOCK.has(name)) out += "\n";
    }
    i = gt + 1;
  }
  return { title: tidy(title).slice(0, 200), text: tidy(out) };
}

// ---------------------------------------------------------------- http

/** The body as text, or null when it is bigger than `max` bytes (checked on the header and while reading, never the whole body first). */
export async function readTextCapped(res: Response, max: number): Promise<string | null> {
  const declared = Number(res.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > max) return null;
  if (!res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let out = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel().catch(() => {});
      return null;
    }
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

async function download(url: string, allowed: readonly string[]): Promise<{ html: string; finalUrl: string } | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!current.startsWith("https://") || !isOnAnyDomain(current, allowed)) return null;
    const res = await fetch(current, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,text/plain;q=0.9" },
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return null;
      current = new URL(next, current).toString();
      continue;
    }
    if (!res.ok) return null;
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/(html|plain)|application\/xhtml/i.test(type)) return null;
    const body = await readTextCapped(res, MAX_BYTES);
    return body === null ? null : { html: body, finalUrl: current };
  }
  return null;
}

/** The page as text, or null when it is not allowed, not found, not text, too small or the host did not answer. */
export async function fetchPage(url: string, allowed: readonly string[], maxChars = 12_000): Promise<FetchedPage | null> {
  if (isWebMock()) {
    if (!isOnAnyDomain(url, allowed)) return null;
    return { url, title: `[mock] ${url}`, text: (mockPages.get(url) ?? `# [mock] Page\n\nFixture text for ${url}. No real content was fetched.`).slice(0, maxChars) };
  }
  try {
    const hit = await cached<CachedPage>(`page:${sha1(url)}`, "web_page", TTL.day, async () => {
      const got = await download(url, allowed);
      if (!got) return null;
      const { title, text } = htmlToText(got.html);
      return text.length >= MIN_TEXT_CHARS ? { url, finalUrl: got.finalUrl, title: title || url, text } : null;
    });
    // The allow-list is checked again on the way out, against the host that really served the text (a redirect may have
    // led somewhere the first caller's list allowed and this caller's list does not).
    if (!hit || !isOnAnyDomain(hit.value.finalUrl, allowed) || !isOnAnyDomain(hit.value.url, allowed)) return null;
    return { url: hit.value.url, title: hit.value.title, text: hit.value.text.slice(0, maxChars) };
  } catch (err) {
    log({ event: "fetch_page_failed", error: err instanceof Error ? err.name : "unknown" });
    return null;
  }
}
