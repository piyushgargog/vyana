import type { LabsCompareRes, PriceQuote } from "../contracts";

const fetched_at = "2026-10-12T09:35:00.000Z";
const q = "hba1c · delhi";

const quote = (p: Omit<PriceQuote, "kind" | "query" | "fetched_at" | "in_stock">): PriceQuote => ({ kind: "lab_test", query: q, fetched_at, in_stock: true, ...p });

const redcliffe = quote({ source: "redcliffe", product_name: "HbA1c (Glycosylated Haemoglobin)", pack_size: "home sample collection", price: 299, mrp: 600, product_url: "https://redcliffelabs.com" });
const healthians = quote({ source: "healthians", product_name: "HbA1c Test", pack_size: "home sample collection", price: 349, mrp: 700, product_url: "https://www.healthians.com" });
const onemgLabs = quote({ source: "1mg_labs", product_name: "Glycosylated Hemoglobin (HbA1c)", pack_size: "home sample collection", price: 399, mrp: 640, product_url: "https://www.1mg.com/labs" });

export const labsCompareMock: LabsCompareRes = {
  query: q,
  quotes: [redcliffe, healthians, onemgLabs],
  sources: [
    { source: "healthians", status: "ok" },
    { source: "redcliffe", status: "ok" },
    { source: "thyrocare", status: "timeout" },
    { source: "1mg_labs", status: "ok" },
  ],
  cheapest: redcliffe,
  cached: true,
};
