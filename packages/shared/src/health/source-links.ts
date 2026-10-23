// packages/shared/src/health/source-links.ts
// Where a person goes to look up a price or blood stock themselves (v1.2.0, ADR-072): plain links to the public pages of the
// pharmacies, labs and e-RaktKosh, with the name already typed in. The app reads no price and no stock from them; it never
// shows a number it did not get from the patient.

import { cleanInlineText } from "../text/clean";

export type PharmacyId = "1mg" | "pharmeasy" | "netmeds" | "apollo";
export type LabId = "healthians" | "redcliffe" | "thyrocare" | "1mg_labs";

export interface LookupLink {
  id: string;
  name: string;
  url: string;
}

export interface LabLookupLink extends LookupLink {
  /** True when the link opens a search for the test; false when it opens the lab's home page and the person searches there. */
  searchesTest: boolean;
}

/** The text a link carries: one line, trimmed, no longer than a medicine or test name can be. */
export const cleanSearchText = (text: string): string => cleanInlineText(text, 80);

const PHARMACIES: { id: PharmacyId; name: string; url: (q: string) => string }[] = [
  { id: "1mg", name: "Tata 1mg", url: (q) => `https://www.1mg.com/search/all?name=${q}` },
  { id: "pharmeasy", name: "PharmEasy", url: (q) => `https://pharmeasy.in/search/all?name=${q}` },
  { id: "netmeds", name: "Netmeds", url: (q) => `https://www.netmeds.com/products?q=${q}` },
  { id: "apollo", name: "Apollo Pharmacy", url: (q) => `https://www.apollopharmacy.in/search-medicines/${q}` },
];

// Only the search pages that answered when checked on 21 Oct 2026 (Tata 1mg Labs and Redcliffe). Healthians and Thyrocare refuse
// automatic checks, so they open the home page instead of a guessed search address.
const LABS: { id: LabId; name: string; url: (q: string) => string; searchesTest: boolean }[] = [
  { id: "1mg_labs", name: "Tata 1mg Labs", url: (q) => `https://www.1mg.com/search/all?name=${q}&filter=true&type=labs`, searchesTest: true },
  { id: "redcliffe", name: "Redcliffe Labs", url: (q) => `https://redcliffelabs.com/search?q=${q}`, searchesTest: true },
  { id: "healthians", name: "Healthians", url: () => "https://www.healthians.com/", searchesTest: false },
  { id: "thyrocare", name: "Thyrocare", url: () => "https://www.thyrocare.com/", searchesTest: false },
];

/** A search for the medicine on each of the four pharmacies. An empty name gives no links. */
export function pharmacySearchLinks(medicine: string): LookupLink[] {
  const text = cleanSearchText(medicine);
  if (!text) return [];
  const q = encodeURIComponent(text);
  return PHARMACIES.map((p) => ({ id: p.id, name: p.name, url: p.url(q) }));
}

/** A search for the test on the labs that have a checked search page, the home page for the rest. */
export function labSearchLinks(test: string): LabLookupLink[] {
  const text = cleanSearchText(test);
  if (!text) return [];
  const q = encodeURIComponent(text);
  return LABS.map((l) => ({ id: l.id, name: l.name, url: l.url(q), searchesTest: l.searchesTest }));
}

/** The public blood stock page of e-RaktKosh (NHM / C-DAC): no sign-in, the person picks state, district and component. */
export const E_RAKTKOSH_URL = "https://eraktkosh.mohfw.gov.in/BLDAHIMS/bloodbank/stockAvailability.cnt";

/** Opens WhatsApp with the text typed in (works with the app and with WhatsApp Web). */
export const whatsappShareUrl = (text: string): string => `https://wa.me/?text=${encodeURIComponent(text.slice(0, 1000))}`;

/** Opens the SMS app with the text typed in. */
export const smsShareUrl = (text: string): string => `sms:?body=${encodeURIComponent(text.slice(0, 600))}`;
