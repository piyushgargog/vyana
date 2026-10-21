import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { BasketCompareRes, BasketLine, PharmacyBasket, PriceSource } from "@vyana/shared";
import { TTL, cached, normalizeKeyPart, sha1 } from "../cache";
import { notFound } from "../errors";
import { openJob, sealJob } from "../jobs";
import { log } from "../log";
import { supabaseAdmin } from "../supabase-admin";
import { type CallCounter, type OutputSchema, cancelRun, fetchPages, getRun, startAgent } from "./client";
import { registerMockPage } from "./fixtures";
import { PHARMACIES, type PharmacySource, absoluteUrl, isOnDomain } from "./sources";

/**
 * Prescription basket pricing (SPEC §12, ADR-035/036): one agent per pharmacy prices the whole basket in the
 * background; every finished result is checked in code and each price is confirmed on the product page.
 */

export interface BasketItem {
  medicine: string;
  strength: string | null;
  quantity: number;
}

/** The remote run is stopped after this long; we give up on a running run a little later. */
export const AGENT_MAX_SECONDS = 150;
export const RUN_DEADLINE_MS = 190_000;

/**
 * A basket agent searches every item on one pharmacy site, so its budget grows with
 * the basket (#225: a flat 150 s cap timed out Tata 1mg and PharmEasy on multi-item
 * baskets while single-item checks finished). Single-task agents (labs, blood) keep
 * the flat AGENT_MAX_SECONDS. The run deadline keeps its 40 s grace over the agent
 * cap and stays under the queue deadline.
 */
export function agentMaxSeconds(itemCount: number): number {
  return Math.min(420, AGENT_MAX_SECONDS + Math.max(0, itemCount - 1) * 30);
}

export function runDeadlineMs(itemCount: number): number {
  return Math.min(QUEUE_DEADLINE_MS, agentMaxSeconds(itemCount) * 1000 + 40_000);
}
/**
 * TinyFish queues runs beyond the account's browser limit (2 at once on our plan, measured 12 Oct), so a run may
 * wait for another pharmacy to finish before it starts. Give queued runs this long from the job's start.
 */
export const QUEUE_DEADLINE_MS = 480_000;
const VERIFY_TIMEOUT_MS = 45_000;
const PRICE_CAP_WITHOUT_MRP = 5000;

// ---------------------------------------------------------------- input

export const itemLabel = (i: BasketItem) => (i.strength ? `${i.medicine} ${i.strength}` : i.medicine);

export function normalizeItems(items: { medicine: string; strength?: string | null; quantity?: number }[]): BasketItem[] {
  return items.map((i) => ({
    medicine: i.medicine.trim().replace(/\s+/g, " "),
    strength: i.strength?.trim().replace(/\s+/g, " ") || null,
    quantity: i.quantity ?? 1,
  }));
}

/** Same basket typed differently or in another order → same key. */
export function basketKey(items: BasketItem[]): string {
  const lines = items.map((i) => normalizeKeyPart(`${i.medicine}|${i.strength ?? ""}|${i.quantity}`)).sort();
  return sha1(lines.join("\n"));
}

// ---------------------------------------------------------------- agent goal + result

export function basketGoal(items: BasketItem[], pharmacy: PharmacySource): string {
  // A direct search link per medicine saves the agent typing into each site's search box.
  const list = items.map((i, n) => `${n + 1}. ${itemLabel(i)} (search results: ${pharmacy.searchUrl(itemLabel(i))})`).join("\n");
  return [
    "For EACH medicine in this numbered list, open its search results link and find the best-matching product on this website.",
    "Do NOT log in, add anything to the cart or buy anything.",
    "For each medicine return: index (its number in the list), found, product_name, pack_size, price (the selling price in rupees, as a number), mrp (in rupees, as a number), in_stock, and the full product_url of the product page (starting with https://).",
    "If a medicine is not sold on this website, return found=false for it. Copy names and prices exactly as the page shows them.",
    "",
    list,
  ].join("\n");
}

export const BASKET_OUTPUT_SCHEMA: OutputSchema = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer", minimum: 1 },
          found: { type: "boolean" },
          product_name: { type: "string", nullable: true },
          pack_size: { type: "string", nullable: true },
          price: { type: "number", nullable: true },
          mrp: { type: "number", nullable: true },
          in_stock: { type: "boolean", nullable: true },
          product_url: { type: "string", nullable: true },
        },
        required: ["index", "found"],
      },
    },
  },
  required: ["items"],
};

const AgentItem = z.object({
  index: z.number().int(),
  found: z.boolean(),
  product_name: z.string().nullish(),
  pack_size: z.string().nullish(),
  price: z.number().nullish(),
  mrp: z.number().nullish(),
  in_stock: z.boolean().nullish(),
  product_url: z.string().nullish(),
});
const AgentResult = z.object({ items: z.array(AgentItem) });
type AgentItem = z.infer<typeof AgentItem>;

// ---------------------------------------------------------------- price checks (§2A)

const round2 = (n: number) => Math.round(n * 100) / 100;

/** 0 < price ≤ 10 × MRP (or ≤ 5000 without an MRP); anything else is not a believable pack price. */
export function plausiblePrice(price: number | null | undefined, mrp: number | null | undefined): number | null {
  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;
  const cap = typeof mrp === "number" && mrp > 0 ? 10 * mrp : PRICE_CAP_WITHOUT_MRP;
  return price <= cap ? round2(price) : null;
}

const MARKERS = ["₹", "rs.", "rs", "inr", "mrp"];

/**
 * Every amount on the page written after a currency marker (₹ 22.66, Rs. 1,200, MRP: 32.28, INR 99).
 * A plain scan instead of a regex, so a long page can't cause slow backtracking.
 */
export function pricesOnPage(text: string): Set<number> {
  const lower = text.toLowerCase();
  const found = new Set<number>();
  for (let i = 0; i < lower.length; i++) {
    const marker = MARKERS.find((m) => lower.startsWith(m, i));
    if (!marker) continue;
    // "rs"/"inr"/"mrp" must start a word ("hours" is not a marker).
    if (marker !== "₹" && i > 0 && /[a-z]/.test(lower[i - 1])) continue;
    let j = i + marker.length;
    for (let skipped = 0; skipped < 4 && j < lower.length && " .: ".includes(lower[j]); skipped++) j++;
    let digits = "";
    while (j < lower.length && /[\d,.]/.test(lower[j])) digits += lower[j++];
    const cleaned = digits.replace(/,/g, "").replace(/\.$/, "");
    if (/^\d+(\.\d+)?$/.test(cleaned)) found.add(round2(Number(cleaned)));
  }
  return found;
}

// ---------------------------------------------------------------- one pharmacy

const emptyLine = (item: BasketItem): BasketLine => ({
  medicine: item.medicine,
  strength: item.strength,
  quantity: item.quantity,
  product_name: null,
  pack_size: null,
  unit_price: null,
  line_total: null,
  in_stock: null,
  product_url: null,
  price_verified: false,
});

export const emptyBasket = (source: PriceSource, status: PharmacyBasket["status"]): PharmacyBasket => ({
  source,
  status,
  lines: [],
  total: null,
  missing: [],
  checkout_url: null,
});

/**
 * Turns one pharmacy's agent result into a checked basket:
 * map by index → product link must be on the pharmacy's site → believable price → price confirmed on the
 * fetched product page → totals of confirmed lines only.
 */
export async function processPharmacyResult(
  pharmacy: PharmacySource,
  items: BasketItem[],
  rawResult: unknown,
  counter?: CallCounter,
): Promise<PharmacyBasket> {
  const parsed = AgentResult.safeParse(rawResult);
  if (!parsed.success) return emptyBasket(pharmacy.source, "error");

  const byIndex = new Map<number, AgentItem>();
  for (const it of parsed.data.items) if (!byIndex.has(it.index)) byIndex.set(it.index, it);

  const startUrl = pharmacy.searchUrl(itemLabel(items[0]));
  const lines: BasketLine[] = items.map((item, n) => {
    const it = byIndex.get(n + 1);
    const url = absoluteUrl(it?.product_url, startUrl);
    if (!it?.found || !url || !isOnDomain(url, pharmacy.domain)) return emptyLine(item);
    return {
      ...emptyLine(item),
      product_name: it.product_name?.trim() || null,
      pack_size: it.pack_size?.trim() || null,
      unit_price: plausiblePrice(it.price, it.mrp),
      in_stock: it.in_stock ?? null,
      product_url: url,
    };
  });

  const toVerify = [...new Set(lines.filter((l) => l.unit_price !== null && l.product_url).map((l) => l.product_url as string))].slice(0, 10);
  const pages = new Map<string, Set<number>>();
  if (toVerify.length) {
    const fetchPrices = async () => {
      const res = await fetchPages({ urls: toVerify, ttl: 0, purpose: "Confirm the listed price of a medicine" }, { timeoutMs: VERIFY_TIMEOUT_MS, counter });
      for (const r of res.results) pages.set(r.url, pricesOnPage(r.text ?? ""));
    };
    try {
      await fetchPrices();
    } catch {
      // One failed batch must not zero the whole pharmacy (#225: a basket showed
      // "Partial" with no total although the agent had found every item, because
      // the single confirmation fetch failed) — retry once before giving up.
      try {
        await fetchPrices();
      } catch {
        log({ event: "basket_verify_failed", source: pharmacy.source });
      }
    }
  }

  for (const l of lines) {
    if (l.unit_price === null || !l.product_url) continue;
    l.price_verified = pages.get(l.product_url)?.has(l.unit_price) ?? false;
    l.line_total = l.price_verified ? round2(l.unit_price * l.quantity) : null;
  }

  const found = lines.filter((l) => l.product_url !== null);
  const verified = lines.filter((l) => l.price_verified);
  const status: PharmacyBasket["status"] =
    found.length === 0 ? "not_found" : verified.length === lines.length ? "ok" : "partial";
  return {
    source: pharmacy.source,
    status,
    lines,
    total: verified.length ? round2(verified.reduce((s, l) => s + (l.line_total ?? 0), 0)) : null,
    missing: lines.filter((l) => l.product_url === null).map((l) => itemLabel(l)),
    checkout_url: found.length ? pharmacy.homeUrl : null,
  };
}

// ---------------------------------------------------------------- whole basket

const STATUS_ORDER: Record<PharmacyBasket["status"], number> = { ok: 0, partial: 1, pending: 2, not_found: 3, timeout: 4, error: 5 };

/** Sorting, cheapest and savings, all in code (SPEC §12 step 4). */
export function summarize(baskets: PharmacyBasket[]): Pick<BasketCompareRes, "baskets" | "cheapest_source" | "savings_vs_highest" | "status"> {
  const sorted = [...baskets].sort(
    (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (a.total ?? Infinity) - (b.total ?? Infinity),
  );
  const complete = sorted.filter((b) => b.status === "ok" && b.total !== null);
  const totals = complete.map((b) => b.total as number);
  return {
    baskets: sorted,
    cheapest_source: complete[0]?.source ?? null,
    savings_vs_highest: complete.length >= 2 ? round2(Math.max(...totals) - Math.min(...totals)) : null,
    status: sorted.some((b) => b.status === "pending") ? "running" : "done",
  };
}

const JobRun = z.object({ source: z.string(), run_id: z.string().nullable(), error: z.string().nullable() });
const JobPayload = z.object({
  v: z.literal(1),
  uid: z.string(),
  key: z.string(),
  items: z.array(z.object({ medicine: z.string(), strength: z.string().nullable(), quantity: z.number().int() })),
  runs: z.array(JobRun),
  started_at: z.number(),
});
type JobPayload = z.infer<typeof JobPayload>;

type StoredResult = Omit<BasketCompareRes, "job_id" | "cached">;

/** Mock mode: a believable, clearly fake result whose product pages "show" the price (so verification passes). */
function mockAgentResult(pharmacy: PharmacySource, items: BasketItem[]) {
  return {
    items: items.map((item, n) => {
      const url = `https://${pharmacy.homeUrl.split("/")[2]}/mock-product/${encodeURIComponent(itemLabel(item).toLowerCase())}`;
      const price = round2(20 + n * 10 + pharmacy.source.length);
      registerMockPage(url, `# [mock] ${itemLabel(item)}\n\nPrice ₹${price}`);
      return { index: n + 1, found: true, product_name: `[mock] ${itemLabel(item)}`, pack_size: "strip of 10", price, mrp: price + 5, in_stock: true, product_url: url };
    }),
  };
}

/** POST: returns a finished basket from cache, or starts one agent per pharmacy and returns `running`. */
export async function startBasketJob(uid: string, items: BasketItem[], counter: CallCounter): Promise<BasketCompareRes> {
  const key = basketKey(items);
  const hit = await cached<StoredResult>(`basket:${key}`, "basket", TTL.day, async () => null);
  if (hit) {
    const job_id = sealJob({ v: 1, uid, key, items, runs: [], started_at: Date.now() } satisfies JobPayload);
    return { ...hit.value, job_id, cached: true };
  }

  const runs = await Promise.all(
    PHARMACIES.map(async (p) => {
      const out = await startAgent(
        {
          url: p.searchUrl(itemLabel(items[0])),
          goal: basketGoal(items, p),
          output_schema: BASKET_OUTPUT_SCHEMA,
          browser_profile: "stealth",
          maxSeconds: agentMaxSeconds(items.length),
          mockResult: process.env.TINYFISH_MOCK === "1" ? mockAgentResult(p, items) : undefined,
        },
        { counter },
      );
      return out.status === "started"
        ? { source: p.source, run_id: out.runId, error: null }
        : { source: p.source, run_id: null, error: out.error };
    }),
  );

  const job: JobPayload = { v: 1, uid, key, items, runs, started_at: Date.now() };
  const baskets = runs.map((r) => emptyBasket(r.source as PriceSource, r.run_id ? "pending" : "error"));
  return { job_id: sealJob(job), ...summarize(baskets), generic: null, cached: false };
}

async function savePriceQuotes(basket: PharmacyBasket) {
  const rows = basket.lines
    .filter((l) => l.price_verified && l.product_name)
    .map((l) => ({
      kind: "medicine",
      query: normalizeKeyPart(itemLabel(l)),
      source: basket.source,
      product_name: l.product_name,
      pack_size: l.pack_size,
      price: l.unit_price,
      mrp: null,
      in_stock: l.in_stock,
      product_url: l.product_url,
    }));
  if (!rows.length || process.env.TINYFISH_MOCK === "1") return;
  try {
    const { error } = await supabaseAdmin().from("price_quotes").insert(rows);
    if (error) log({ event: "price_quotes_insert_failed", source: basket.source });
  } catch {
    log({ event: "price_quotes_insert_failed", source: basket.source });
  }
}

/** The basket for one run: from cache when already processed, else from the run's current state. */
async function basketForRun(run: z.infer<typeof JobRun>, job: JobPayload, counter: CallCounter): Promise<PharmacyBasket> {
  const source = run.source as PriceSource;
  const pharmacy = PHARMACIES.find((p) => p.source === source);
  if (!pharmacy || !run.run_id) return emptyBasket(source, "error");
  const runId = run.run_id;

  let state: "pending" | "timeout" | "error" = "pending";
  const done = await cached<PharmacyBasket>(`basketrun:${runId}`, "basket_run", TTL.day, async () => {
    const r = await getRun(runId, { counter });
    if (r.status === "COMPLETED") {
      const basket = await processPharmacyResult(pharmacy, job.items, r.result, counter);
      await savePriceQuotes(basket);
      return basket;
    }
    if (r.status === "FAILED" || r.status === "CANCELLED") {
      state = r.error === "TIMEOUT" || r.error === "MAX_STEPS_EXCEEDED" || r.status === "CANCELLED" ? "timeout" : "error";
      return null;
    }
    const now = Date.now();
    const stuckRunning = r.status === "RUNNING" && r.startedAt !== null && now - r.startedAt > runDeadlineMs(job.items.length);
    const stuckQueued = now - job.started_at > QUEUE_DEADLINE_MS;
    if (stuckRunning || stuckQueued) {
      await cancelRun(runId, { counter });
      state = "timeout";
    }
    return null;
  });
  return done?.value ?? emptyBasket(source, state);
}

/** GET: reports the job; finished pharmacies are processed once and cached. */
export async function pollBasketJob(uid: string, jobId: string, counter: CallCounter): Promise<BasketCompareRes> {
  const parsed = JobPayload.safeParse(openJob(jobId));
  if (!parsed.success || parsed.data.uid !== uid) throw notFound("This price check was not found. Start a new one.");
  const job = parsed.data;

  if (job.runs.length === 0) {
    const hit = await cached<StoredResult>(`basket:${job.key}`, "basket", TTL.day, async () => null);
    if (!hit) throw notFound("This price check has expired. Start a new one.");
    return { ...hit.value, job_id: jobId, cached: true };
  }

  const baskets = await Promise.all(job.runs.map((r) => basketForRun(r, job, counter)));
  const summary = summarize(baskets);
  const result: StoredResult = { ...summary, generic: null };
  if (summary.status === "done" && baskets.some((b) => b.lines.some((l) => l.price_verified))) {
    await cached<StoredResult>(`basket:${job.key}`, "basket", TTL.day, async () => result);
  }
  return { ...result, job_id: jobId, cached: false };
}

/** Loads the active items of one of the caller's prescriptions (RLS decides what they may read). */
export async function itemsFromPrescription(sb: SupabaseClient, prescriptionId: string): Promise<BasketItem[]> {
  const { data, error } = await sb
    .from("prescription_items")
    .select("medicine_name, strength")
    .eq("prescription_id", prescriptionId)
    .eq("active", true);
  if (error) throw error;
  const rows = (data ?? []) as { medicine_name: string; strength: string | null }[];
  if (!rows.length) throw notFound("No active medicines found on this prescription.");
  return normalizeItems(rows.slice(0, 10).map((r) => ({ medicine: r.medicine_name, strength: r.strength })));
}
