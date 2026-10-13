import type { LabsCompareRes, PriceQuote } from "../contracts";

const fetched_at = "2026-10-12T09:35:00.000Z";
const q = "hba1c · delhi";

const quote = (p: Omit<PriceQuote, "kind" | "query" | "fetched_at" | "in_stock">): PriceQuote => ({ kind: "lab_test", query: q, fetched_at, in_stock: true, ...p });

const redcliffe = quote({ source: "redcliffe", product_name: "HbA1c (Glycosylated Haemoglobin)", pack_size: null, price: 299, mrp: 600, product_url: "https://redcliffelabs.com/delhi/tests/hba1c-test", price_verified: true });
const healthians = quote({ source: "healthians", product_name: "HbA1c Test", pack_size: null, price: 349, mrp: 700, product_url: "https://www.healthians.com/profile/delhi/hba1c", price_verified: true });
const onemgLabs = quote({ source: "1mg_labs", product_name: "Glycosylated Hemoglobin (HbA1c)", pack_size: null, price: 399, mrp: 640, product_url: "https://www.1mg.com/labs/test/hba1c-glycosylated-hemoglobin-1611/new-delhi/price", price_verified: true });
const thyrocare = quote({ source: "thyrocare", product_name: "HbA1c", pack_size: null, price: 250, mrp: null, product_url: "https://www.thyrocare.com/diagnostics/tests/hba1c-34", price_verified: false });

/** A finished lab compare (mock): verified prices first, then "price not confirmed" ones. */
export const labsCompareMock: LabsCompareRes = {
  job_id: "mock-labs-job-done",
  status: "done",
  query: q,
  city: "Delhi",
  quotes: [redcliffe, healthians, onemgLabs, thyrocare],
  sources: [
    { source: "healthians", status: "ok" },
    { source: "redcliffe", status: "ok" },
    { source: "thyrocare", status: "ok" },
    { source: "1mg_labs", status: "ok" },
  ],
  cheapest: redcliffe,
  cached: false,
};

/** What `labs.compare` returns while the agents run: poll `labs.job(job_id)` until `status` is "done". */
export const labsJobRunningMock: LabsCompareRes = {
  job_id: "mock-labs-job-done",
  status: "running",
  query: q,
  city: "Delhi",
  quotes: [],
  sources: [
    { source: "healthians", status: "pending" },
    { source: "redcliffe", status: "pending" },
    { source: "thyrocare", status: "pending" },
    { source: "1mg_labs", status: "pending" },
  ],
  cheapest: null,
  cached: false,
};
