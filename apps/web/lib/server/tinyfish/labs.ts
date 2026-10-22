import "server-only";
import { z } from "zod";
import type { LabsCompareRes, PriceQuote, SourceStatus } from "@vyana/shared";
import { TTL, cached, normalizeKeyPart } from "../cache";
import { notFound } from "../errors";
import { openJob, sealJob } from "../jobs";
import { log } from "../log";
import { AGENT_MAX_SECONDS, QUEUE_DEADLINE_MS, RUN_DEADLINE_MS, plausiblePrice, pricesOnPage } from "./basket";
import { type CallCounter, type OutputSchema, cancelRun, fetchPages, getRun, search, startAgent } from "./client";
import { registerMockPage } from "./fixtures";
import { LABS, type LabSource, absoluteUrl, isOnDomain } from "./sources";

/**
 * Lab test price compare (SPEC §2, ADR-050): a background job like the basket. Search finds each lab's own test page,
 * one agent per lab reads the price there, and a price counts only when the fetched page shows it (ADR-036).
 */

const VERIFY_TIMEOUT_MS = 45_000;

export const labQuery = (test: string, city: string) => `${normalizeKeyPart(test)} · ${normalizeKeyPart(city)}`;

export function labGoal(test: string, city: string, lab: LabSource): string {
  return [
    `On this ${lab.name} website, find the lab test "${test}" offered in ${city}.`,
    "If this page is not that test, use the site's search to open it. Return the test's exact name as shown, its selling price in rupees, the MRP if shown, and the URL of the test's page.",
    "Return found=false if the test isn't offered. Copy the price exactly as shown; never estimate. Do not log in, book or pay.",
    "If a CAPTCHA or login appears, stop and return found=false.",
  ].join(" ");
}

export const LAB_OUTPUT_SCHEMA: OutputSchema = {
  type: "object",
  properties: {
    found: { type: "boolean" },
    test_name: { type: "string", nullable: true },
    price: { type: "number", nullable: true },
    mrp: { type: "number", nullable: true },
    test_url: { type: "string", nullable: true },
  },
  required: ["found"],
};

const AgentResult = z.object({
  found: z.boolean(),
  test_name: z.string().nullish(),
  price: z.number().nullish(),
  mrp: z.number().nullish(),
  test_url: z.string().nullish(),
});

type LabOutcome = { status: Exclude<SourceStatus["status"], "pending">; quote: PriceQuote | null };

/** One lab's agent result → a checked quote: page on the lab's domain → believable price → seen on the fetched page. */
export async function processLabResult(lab: LabSource, test: string, city: string, startUrl: string, raw: unknown, counter?: CallCounter): Promise<LabOutcome> {
  const parsed = AgentResult.safeParse(raw);
  if (!parsed.success) return { status: "error", quote: null };
  const r = parsed.data;
  const url = absoluteUrl(r.test_url, startUrl);
  if (!r.found || !url || !isOnDomain(url, lab.domain)) return { status: "not_found", quote: null };

  const price = plausiblePrice(r.price, r.mrp);
  let verified = false;
  if (price !== null) {
    try {
      const res = await fetchPages({ urls: [url], ttl: 0, purpose: "Confirm the listed price of a lab test" }, { timeoutMs: VERIFY_TIMEOUT_MS, counter });
      verified = pricesOnPage(res.results[0]?.text ?? "").has(price);
    } catch {
      log({ event: "lab_verify_failed", source: lab.source });
    }
  }
  return {
    status: "ok",
    quote: {
      kind: "lab_test",
      query: labQuery(test, city),
      source: lab.source,
      product_name: r.test_name?.trim() || test,
      pack_size: null,
      price,
      mrp: plausiblePrice(r.mrp, null),
      in_stock: null,
      product_url: url,
      fetched_at: new Date().toISOString(),
      price_verified: verified,
    },
  };
}

/** Verified first, by price; then unverified; `cheapest` is the lowest verified price. */
export function summarizeLabs(outcomes: { source: LabSource["source"]; status: SourceStatus["status"]; quote: PriceQuote | null }[]) {
  const quotes = outcomes
    .flatMap((o) => (o.quote ? [o.quote] : []))
    .sort((a, b) => Number(!a.price_verified) - Number(!b.price_verified) || (a.price ?? Infinity) - (b.price ?? Infinity));
  return {
    quotes,
    sources: outcomes.map((o) => ({ source: o.source, status: o.status })),
    cheapest: quotes.find((q) => q.price_verified && q.price !== null) ?? null,
    status: outcomes.some((o) => o.status === "pending") ? ("running" as const) : ("done" as const),
  };
}

// ---------------------------------------------------------------- job

const JobRun = z.object({ source: z.string(), run_id: z.string().nullable(), start_url: z.string() });
const LabJob = z.object({ v: z.literal(1), kind: z.literal("labs"), uid: z.string(), test: z.string(), city: z.string(), runs: z.array(JobRun), started_at: z.number() });
type LabJob = z.infer<typeof LabJob>;
type Stored = Omit<LabsCompareRes, "job_id" | "cached">;

const cacheKey = (test: string, city: string) => `lab:${normalizeKeyPart(test)}:${normalizeKeyPart(city)}`;

function mockResult(lab: LabSource, test: string) {
  const url = `https://${new URL(lab.homeUrl).host}/mock-test/${encodeURIComponent(test.toLowerCase())}`;
  const price = 200 + lab.source.length * 10;
  registerMockPage(url, `# [mock] ${test}\n\nPrice ₹${price}`);
  return { found: true, test_name: `[mock] ${test}`, price, mrp: price * 2, test_url: url };
}

/** POST: a finished compare from cache, or one agent per lab started on the lab's own test page. */
export async function startLabJob(uid: string, testIn: string, cityIn: string, counter: CallCounter): Promise<LabsCompareRes> {
  const test = testIn.trim().replace(/\s+/g, " ");
  const city = cityIn.trim().replace(/\s+/g, " ");
  const hit = await cached<Stored>(cacheKey(test, city), "labs", TTL.day, async () => null);
  if (hit) {
    const job_id = sealJob({ v: 1, kind: "labs", uid, test, city, runs: [], started_at: Date.now() } satisfies LabJob);
    return { ...hit.value, job_id, cached: true };
  }

  const runs = await Promise.all(
    LABS.map(async (lab) => {
      let startUrl = lab.homeUrl;
      try {
        const res = await search({ query: `${test} test price ${city}`, include_domains: [lab.domain] }, { counter });
        startUrl = res.results.map((r) => r.url).find((u) => isOnDomain(u, lab.domain)) ?? lab.homeUrl;
      } catch {
        log({ event: "lab_search_failed", source: lab.source });
      }
      const out = await startAgent(
        {
          url: startUrl,
          goal: labGoal(test, city, lab),
          output_schema: LAB_OUTPUT_SCHEMA,
          browser_profile: "stealth",
          maxSeconds: AGENT_MAX_SECONDS,
          mockResult: process.env.TINYFISH_MOCK === "1" ? mockResult(lab, test) : undefined,
        },
        { counter },
      );
      return { source: lab.source, run_id: out.status === "started" ? out.runId : null, start_url: startUrl };
    }),
  );

  const job: LabJob = { v: 1, kind: "labs", uid, test, city, runs, started_at: Date.now() };
  const outcomes = runs.map((r) => ({ source: r.source as LabSource["source"], status: (r.run_id ? "pending" : "error") as SourceStatus["status"], quote: null }));
  return { job_id: sealJob(job), query: labQuery(test, city), city, ...summarizeLabs(outcomes), cached: false };
}

async function outcomeForRun(run: z.infer<typeof JobRun>, job: LabJob, counter: CallCounter) {
  const lab = LABS.find((l) => l.source === run.source);
  if (!lab || !run.run_id) return { source: run.source as LabSource["source"], status: "error" as const, quote: null };
  const runId = run.run_id;
  let state: "pending" | "timeout" | "error" = "pending";
  const done = await cached<LabOutcome>(`labrun:${runId}`, "lab_run", TTL.day, async () => {
    const r = await getRun(runId, { counter });
    if (r.status === "COMPLETED") return processLabResult(lab, job.test, job.city, run.start_url, r.result, counter);
    if (r.status === "FAILED" || r.status === "CANCELLED") {
      state = r.error === "TIMEOUT" || r.error === "MAX_STEPS_EXCEEDED" || r.status === "CANCELLED" ? "timeout" : "error";
      return null;
    }
    const now = Date.now();
    // Same rule as the basket: the queue deadline counts only the wait for a browser. Once a run has started
    // (`startedAt` is set), only its own run deadline applies, however long it waited in the queue.
    const stuckRunning = r.status === "RUNNING" && r.startedAt !== null && now - r.startedAt > RUN_DEADLINE_MS;
    const stuckQueued = r.startedAt === null && now - job.started_at > QUEUE_DEADLINE_MS;
    if (stuckRunning || stuckQueued) {
      await cancelRun(runId, { counter });
      state = "timeout";
    }
    return null;
  });
  return done ? { source: lab.source, ...done.value } : { source: lab.source, status: state, quote: null };
}

/** GET: the job's progress; finished labs are processed once and cached. */
export async function pollLabJob(uid: string, jobId: string, counter: CallCounter): Promise<LabsCompareRes> {
  const parsed = LabJob.safeParse(openJob(jobId));
  if (!parsed.success || parsed.data.uid !== uid) throw notFound("This price check was not found. Start a new one.");
  const job = parsed.data;

  if (job.runs.length === 0) {
    const hit = await cached<Stored>(cacheKey(job.test, job.city), "labs", TTL.day, async () => null);
    if (!hit) throw notFound("This price check has expired. Start a new one.");
    return { ...hit.value, job_id: jobId, cached: true };
  }

  const outcomes = await Promise.all(job.runs.map((r) => outcomeForRun(r, job, counter)));
  const result: Stored = { query: labQuery(job.test, job.city), city: job.city, ...summarizeLabs(outcomes) };
  if (result.status === "done" && result.quotes.some((q) => q.price_verified)) {
    await cached<Stored>(cacheKey(job.test, job.city), "labs", TTL.day, async () => result);
  }
  return { ...result, job_id: jobId, cached: false };
}
