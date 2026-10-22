import "server-only";

/**
 * Which sites Vyana reads (ADR-043, ADR-072). Public-health bodies and medical libraries only: every page the app reads,
 * and every link the assistant shows, is on one of these hosts.
 */

/** True when `url` is http(s) and its host is `domain` or a subdomain of it. */
export function isOnDomain(url: string, domain: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

export const isOnAnyDomain = (url: string, domains: readonly string[]): boolean => domains.some((d) => isOnDomain(url, d));

/** The only sites the assistant may search or open. */
export const TRUSTED_HEALTH_DOMAINS: readonly string[] = [
  "who.int",
  "mohfw.gov.in",
  "medlineplus.gov",
  "nhs.uk",
  "cdc.gov",
  "ncbi.nlm.nih.gov",
  "icmr.gov.in",
  "cdsco.gov.in",
];

export const isTrustedHealthUrl = (url: string): boolean => isOnAnyDomain(url, TRUSTED_HEALTH_DOMAINS);

/** The sites a care plan may quote. */
export const CARE_PLAN_DOMAINS: readonly string[] = ["mohfw.gov.in", "icmr.gov.in", "who.int", "nhs.uk", "medlineplus.gov", "nhm.gov.in"];

/** Tests and local development: no network, fixture pages. Every title starts with "[mock]" so fixtures are never mistaken for real pages. */
export const isWebMock = (): boolean => process.env.WEB_MOCK === "1";
