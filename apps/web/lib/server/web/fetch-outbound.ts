import "server-only";
import { readTextCapped } from "./fetch-page";

/**
 * The one outbound fetch every server caller goes through (issue #661): a timeout, one identifying User-Agent, and a
 * streaming size cap. Before this helper the same idea was spelled six ways (fetch-page, e-RaktKosh, Overpass,
 * MedlinePlus, Nominatim, Expo push) with four User-Agent strings and uneven caps, and two callers swallowed an
 * unbounded body. The per-caller detail keeps the old wording (for example "nearby hospitals") after one shared stem.
 */

/** The stem every outbound call sends: one version string, one contact address. */
export const VYANA_USER_AGENT = "Vyana/1.2 (+https://vyanahealth.app; patient health app)";

/** The stem with a per-caller detail, in the shape the callers already used. */
export function userAgent(detail: string): string {
  return detail ? `Vyana/1.2 (+https://vyanahealth.app; patient health app; ${detail})` : VYANA_USER_AGENT;
}

export interface FetchOutboundOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /** How long to wait for an answer, in milliseconds. Defaults to 10 seconds. */
  timeoutMs?: number;
  /** Per-caller detail appended to the shared User-Agent, for example "nearby hospitals". */
  userAgentDetail?: string;
  redirect?: RequestRedirect;
  /** A fetch to use instead of the global one; the push tests inject a stub. */
  fetchImpl?: typeof fetch;
}

/**
 * One fetch with a timeout and an identifying User-Agent. Throws on a network error or a timeout, like fetch does,
 * so callers keep their own shape for a failed call (log and return null, or throw a 502).
 */
export async function fetchOutbound(url: string, options: FetchOutboundOptions = {}): Promise<Response> {
  const doFetch = options.fetchImpl ?? fetch;
  return doFetch(url, {
    method: options.method,
    headers: { ...(options.headers ?? {}), "User-Agent": userAgent(options.userAgentDetail ?? "") },
    body: options.body,
    redirect: options.redirect,
    signal: AbortSignal.timeout(options.timeoutMs ?? 10_000),
  });
}

/**
 * The response body as JSON, or null when it is bigger than `max` bytes or is not JSON. The cap is checked on the
 * header and while reading, never after the whole body is buffered (see `readTextCapped`).
 */
export async function readJsonCapped<T>(res: Response, max: number): Promise<T | null> {
  const text = await readTextCapped(res, max);
  if (text === null) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}
