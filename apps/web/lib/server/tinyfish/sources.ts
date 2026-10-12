import "server-only";
import type { PriceSource } from "@vyana/shared";

/**
 * Where each TinyFish agent starts. Start URLs were checked on 12 Oct 2026 with `pnpm smoke:tinyfish`
 * (see docs/SPEC.md §12). If a site changes its search URL, update it here and in SPEC together.
 */

export interface PharmacySource {
  source: PriceSource;
  name: string;
  /** Registrable domain: every product URL an agent returns must be on this host or a subdomain of it. */
  domain: string;
  /** Where the user goes to order: we never log in or add to cart for them. */
  homeUrl: string;
  searchUrl: (query: string) => string;
}

export const PHARMACIES: readonly PharmacySource[] = [
  { source: "1mg", name: "Tata 1mg", domain: "1mg.com", homeUrl: "https://www.1mg.com/", searchUrl: (q) => `https://www.1mg.com/search/all?name=${encodeURIComponent(q)}` },
  { source: "pharmeasy", name: "PharmEasy", domain: "pharmeasy.in", homeUrl: "https://pharmeasy.in/", searchUrl: (q) => `https://pharmeasy.in/search/all?name=${encodeURIComponent(q)}` },
  // The old /catalogsearch/result/{q}/all path returns 404 since the site moved.
  { source: "netmeds", name: "Netmeds", domain: "netmeds.com", homeUrl: "https://www.netmeds.com/", searchUrl: (q) => `https://www.netmeds.com/products?q=${encodeURIComponent(q)}` },
  { source: "apollo", name: "Apollo Pharmacy", domain: "apollopharmacy.in", homeUrl: "https://www.apollopharmacy.in/", searchUrl: (q) => `https://www.apollopharmacy.in/search-medicines/${encodeURIComponent(q)}` },
];

export const NMC_REGISTER_URL = "https://www.nmc.org.in/information-desk/indian-medical-register/";

/**
 * Agents sometimes copy a link as it appears in the page's HTML, e.g. "/otc/dolo-650mg-tablet-15-s" (Apollo,
 * 12 Oct). Resolve it against the page the agent started on, so it can still pass the domain check. Returns null
 * for anything that isn't a usable http(s) URL.
 */
export function absoluteUrl(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(href.trim(), base);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** True when `url` is http(s) and its host is `domain` or a subdomain of it (used by the §2A price checks). */
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

/**
 * The only sites the assistant may search or open (PLAN §6.4, ADR-043): public-health bodies and medical
 * libraries. Every link the assistant shows comes from one of these.
 */
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

export function isTrustedHealthUrl(url: string): boolean {
  return TRUSTED_HEALTH_DOMAINS.some((d) => isOnDomain(url, d));
}

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
