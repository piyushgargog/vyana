import type { MedicinesCompareRes, PriceQuote } from "../contracts";

const fetched_at = "2026-10-12T09:30:00.000Z";
const q = "dolo 650";

const quote = (p: Omit<PriceQuote, "kind" | "query" | "fetched_at">): PriceQuote => ({ kind: "medicine", query: q, fetched_at, ...p });

const pharmeasy = quote({ source: "pharmeasy", product_name: "Dolo 650 Tablet", pack_size: "strip of 15 tablets", price: 28.9, mrp: 33.95, in_stock: true, product_url: "https://pharmeasy.in/search/all?name=dolo%20650" });
const onemg = quote({ source: "1mg", product_name: "Dolo 650 Tablet", pack_size: "strip of 15 tablets", price: 30.5, mrp: 33.95, in_stock: true, product_url: "https://www.1mg.com/search/all?name=dolo%20650" });
const netmeds = quote({ source: "netmeds", product_name: "Dolo 650mg Strip Of 15 Tablets", pack_size: "strip of 15 tablets", price: 31.2, mrp: 33.95, in_stock: true, product_url: "https://www.netmeds.com/catalogsearch/result/dolo%20650/all" });
const apollo = quote({ source: "apollo", product_name: "Dolo-650 Tablet 15s", pack_size: "15 tablets", price: null, mrp: 33.95, in_stock: false, product_url: "https://www.apollopharmacy.in/search-medicines/dolo%20650" });

export const medicinesCompareMock: MedicinesCompareRes = {
  query: q,
  quotes: [pharmeasy, onemg, netmeds, apollo],
  sources: [
    { source: "1mg", status: "ok" },
    { source: "pharmeasy", status: "ok" },
    { source: "netmeds", status: "ok" },
    { source: "apollo", status: "ok" },
  ],
  cheapest: pharmeasy,
  generic: {
    kind: "medicine", query: q, fetched_at, source: "janaushadhi",
    product_name: "Paracetamol Tablets IP 650 mg", pack_size: "strip of 15 tablets",
    price: 12, mrp: 12, in_stock: null, product_url: "https://janaushadhi.gov.in",
  },
  generic_salt: "Paracetamol 650 mg",
  cached: false,
};
