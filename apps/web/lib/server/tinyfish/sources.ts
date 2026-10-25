import "server-only";
import type { PriceSource } from "@vyana/shared";
import { TRUSTED_HEALTH_DOMAINS, isTrustedHealthUrl } from "../web/domains";

export { TRUSTED_HEALTH_DOMAINS, isTrustedHealthUrl };

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
 * for anything that isn't a usable https URL: a link Vyana shows or prices from is never a plain-http link.
 */
export function absoluteUrl(href: string | null | undefined, base: string): string | null {
  if (!href) return null;
  try {
    const u = new URL(href.trim(), base);
    return u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * True when `url` is https and its host is `domain` or a subdomain of it (used by the §2A price checks).
 * Deliberately stricter than `web/domains`' copy, which also allows http for the pages the app reads:
 * a product, lab or scheme link that reaches a patient must be TLS-protected.
 */
export function isOnDomain(url: string, domain: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const host = u.hostname.toLowerCase();
    return host === domain || host.endsWith(`.${domain}`);
  } catch {
    return false;
  }
}

/** Government pages only: a third party's list can't say a hospital is empanelled (ADR-048). Https only, like every link Vyana hands out. */
export function isGovUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return u.protocol === "https:" && (host.endsWith(".gov.in") || host.endsWith(".nic.in"));
  } catch {
    return false;
  }
}

export interface LabSource {
  source: PriceSource;
  name: string;
  /** Registrable domain: the test page an agent returns must be on this host or a subdomain of it. */
  domain: string;
  /** Agent start when Search finds no page for the test, and where the user books. */
  homeUrl: string;
}

/** Labs for the lab test price compare (SPEC §2, ADR-050). Test pages found live by Search on 13 Oct. */
export const LABS: readonly LabSource[] = [
  { source: "healthians", name: "Healthians", domain: "healthians.com", homeUrl: "https://www.healthians.com/" },
  { source: "redcliffe", name: "Redcliffe Labs", domain: "redcliffelabs.com", homeUrl: "https://redcliffelabs.com/" },
  { source: "thyrocare", name: "Thyrocare", domain: "thyrocare.com", homeUrl: "https://www.thyrocare.com/" },
  { source: "1mg_labs", name: "Tata 1mg Labs", domain: "1mg.com", homeUrl: "https://www.1mg.com/labs" },
];
