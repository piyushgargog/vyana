import "server-only";
import { z } from "zod";
import { upstream } from "../errors";
import { log } from "../log";
import { requireEnv } from "../supabase-admin";
import { mockFetch, mockSearch } from "./fixtures";

/**
 * TinyFish REST client (DESIGN §3). One function per API: auth header, timeout, retry, mock mode.
 * No domain logic here: services in this folder decide what to search, fetch or ask an agent to do.
 * Reference: https://docs.tinyfish.ai (Search, Fetch, Agent, Monitor API references).
 */

const SEARCH_URL = "https://api.search.tinyfish.ai";
const FETCH_URL = "https://api.fetch.tinyfish.ai";
const AGENT_URL = "https://agent.tinyfish.ai/v1";

export const TIMEOUTS = { search: 10_000, fetch: 60_000, agent: 90_000, monitor: 15_000 } as const;

/** Where a route counts its TinyFish calls for the request log (`RouteContext.tinyfishCalls`). */
export interface CallCounter {
  tinyfishCalls: number;
}

export interface CallOptions {
  timeoutMs?: number;
  counter?: CallCounter;
}

const isMock = () => process.env.TINYFISH_MOCK === "1";

/**
 * The key pool (ADR-039 addendum): `TINYFISH_API_KEYS` (comma-separated) or the single `TINYFISH_API_KEY`. Several
 * keys let agent runs go out in parallel (each account runs 2 at a time). Only add keys once TinyFish's terms allow
 * using several accounts together.
 */
export function apiKeys(): string[] {
  const pool = (process.env.TINYFISH_API_KEYS ?? "").split(",").map((k) => k.trim()).filter(Boolean);
  return pool.length ? pool : [requireEnv("TINYFISH_API_KEY")];
}

let nextKey = 0;

/**
 * A run belongs to the key that started it, so with a pool its id carries the key's number: `2~<id>`. With one key the
 * id is TinyFish's own, exactly as before.
 */
export function splitRunId(runId: string): { key: number; id: string } {
  const m = /^(\d{1,2})~(.+)$/.exec(runId);
  return m ? { key: Number(m[1]), id: m[2] } : { key: 0, id: runId };
}

function headers(json: boolean, key = 0): HeadersInit {
  const keys = apiKeys();
  const h: Record<string, string> = { "X-API-Key": keys[key % keys.length] };
  if (json) h["Content-Type"] = "application/json";
  return h;
}

function count(opts?: CallOptions) {
  if (opts?.counter) opts.counter.tinyfishCalls++;
}

/** HTTP-level failure from TinyFish. The message is safe for users; the status goes to the log only. */
function httpFailure(api: string, status: number) {
  log({ event: "tinyfish_http_error", api, status });
  if (status === 402) return upstream("The live web lookup is out of credits right now. Try again later.");
  if (status === 429) return upstream("Too many live web lookups at once. Try again in a minute.");
  return upstream("The live web lookup failed. Try again.");
}

function invalidResponse(api: string) {
  log({ event: "tinyfish_invalid_response", api });
  return upstream("The live web lookup returned something unexpected. Try again.");
}

// ---------------------------------------------------------------- Search (free)

export interface SearchParams {
  query: string;
  include_domains?: string[];
  exclude_domains?: string[];
  /** Country code, e.g. "IN". */
  location?: string;
  language?: string;
  recency_minutes?: number;
  purpose?: string;
}

const SearchResult = z.object({
  position: z.number(),
  site_name: z.string().optional().default(""),
  title: z.string().optional().default(""),
  snippet: z.string().optional().default(""),
  url: z.string(),
  date: z.string().optional(),
});
const SearchResponse = z.object({
  query: z.string(),
  results: z.array(SearchResult),
  total_results: z.number().optional(),
  page: z.number().optional(),
});
export type SearchResult = z.infer<typeof SearchResult>;
export type SearchResponse = z.infer<typeof SearchResponse>;

/** Web search. 10 s timeout, one retry on a 5xx or network error. */
export async function search(params: SearchParams, opts?: CallOptions): Promise<SearchResponse> {
  if (isMock()) return mockSearch(params);
  const qs = new URLSearchParams({ query: params.query });
  if (params.include_domains?.length) qs.set("include_domains", params.include_domains.join(","));
  if (params.exclude_domains?.length) qs.set("exclude_domains", params.exclude_domains.join(","));
  if (params.location) qs.set("location", params.location);
  if (params.language) qs.set("language", params.language);
  if (params.recency_minutes) qs.set("recency_minutes", String(params.recency_minutes));
  if (params.purpose) qs.set("purpose", params.purpose);

  const timeoutMs = opts?.timeoutMs ?? TIMEOUTS.search;
  for (let attempt = 1; ; attempt++) {
    count(opts);
    let res: Response;
    try {
      res = await fetch(`${SEARCH_URL}?${qs}`, { headers: headers(false), signal: AbortSignal.timeout(timeoutMs) });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "TimeoutError";
      if (!isTimeout && attempt === 1) continue; // network error: retry once
      throw err; // a timeout becomes 504 in withRoute
    }
    if (res.status >= 500 && attempt === 1) continue;
    if (!res.ok) throw httpFailure("search", res.status);
    const parsed = SearchResponse.safeParse(await res.json().catch(() => null));
    if (!parsed.success) throw invalidResponse("search");
    return parsed.data;
  }
}

// ---------------------------------------------------------------- Fetch (free)

export interface FetchParams {
  /** 1–10 http(s) URLs. */
  urls: string[];
  format?: "markdown" | "html";
  links?: boolean;
  /** Ranked verbatim passages answering `query` (beta: needs account access, else 403). */
  highlights?: { query: string; max_snippets?: number };
  /** Accept a cached copy younger than this many seconds; 0 = live fetch. */
  ttl?: number;
  purpose?: string;
}

const FetchResult = z.object({
  url: z.string(),
  final_url: z.string().optional(),
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  links: z.array(z.string()).optional(),
  highlights: z.array(z.object({ text: z.string(), rank: z.number() })).optional(),
  latency_ms: z.number().nullable().optional(),
  format: z.string().optional(),
});
const FetchError = z.object({ url: z.string(), error: z.string(), status: z.number().optional() });
const FetchResponse = z.object({ results: z.array(FetchResult), errors: z.array(FetchError).default([]) });
export type FetchResult = z.infer<typeof FetchResult>;
export type FetchError = z.infer<typeof FetchError>;
export type FetchResponse = z.infer<typeof FetchResponse>;

/** Fetches up to 10 pages as clean text. Per-URL failures come back in `errors`, not as an exception. No retry. */
export async function fetchPages(params: FetchParams, opts?: CallOptions): Promise<FetchResponse> {
  if (params.urls.length < 1 || params.urls.length > 10) throw new Error("fetchPages takes 1 to 10 URLs");
  if (isMock()) return mockFetch(params);
  const timeoutMs = opts?.timeoutMs ?? TIMEOUTS.fetch;
  count(opts);
  const res = await fetch(FETCH_URL, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      urls: params.urls,
      format: params.format ?? "markdown",
      links: params.links ?? false,
      ...(params.highlights ? { highlights: params.highlights } : {}),
      ...(params.ttl !== undefined ? { ttl: params.ttl } : {}),
      ...(params.purpose ? { purpose: params.purpose } : {}),
      // Leave a little of our budget to receive the per-URL timeout errors.
      per_url_timeout_ms: Math.max(1_000, Math.min(110_000, timeoutMs - 5_000)),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw httpFailure("fetch", res.status);
  const parsed = FetchResponse.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw invalidResponse("fetch");
  return parsed.data;
}

// ---------------------------------------------------------------- Agent (paid)

/** Max agent runs per minute in this process, so a bug or a loop can't burn the credits (DESIGN §3). */
export const AGENT_CALLS_PER_MINUTE = 12;
const agentCalls: number[] = [];

function takeAgentSlot(now = Date.now()): boolean {
  while (agentCalls.length && now - agentCalls[0] >= 60_000) agentCalls.shift();
  if (agentCalls.length >= AGENT_CALLS_PER_MINUTE) return false;
  agentCalls.push(now);
  return true;
}

/** Test helper: clears the credit guard window. */
export function resetCreditGuard() {
  agentCalls.length = 0;
}

/**
 * The subset of JSON Schema TinyFish accepts for `output_schema`: top level must be an object; no
 * `additionalProperties`, `oneOf` or `const`; use `nullable: true` instead of type arrays.
 */
export type OutputSchema = { type: "object"; properties: Record<string, unknown>; required?: string[] };

export interface AgentParams<T> {
  url: string;
  goal: string;
  output_schema?: OutputSchema;
  browser_profile?: "lite" | "stealth";
  /** Validates the agent's result; a result that fails becomes `status: "error"`. */
  parse?: (result: unknown) => T;
  /** Returned in mock mode instead of calling the agent. Omitted → `not_found`. */
  mockResult?: unknown;
  /** Live progress lines ("Searching for Dolo 650…"). Passing it streams the run over SSE. */
  onProgress?: (purpose: string) => void;
}

export type AgentStatus = "ok" | "not_found" | "timeout" | "error";

export interface AgentOutcome<T> {
  status: AgentStatus;
  result: T | null;
  runId: string | null;
  /** TinyFish error code, or ours: `credit_guard`, `invalid_result`, `stream_ended`, `http_<status>`. */
  error?: string;
}

const RunError = z.object({ code: z.string().optional(), message: z.string().optional(), category: z.string().optional() }).nullable().optional();
const RunResult = z.object({
  run_id: z.string().nullable().optional(),
  status: z.string(),
  result: z.unknown().optional(),
  error: RunError,
});
type RunResult = z.infer<typeof RunResult>;

const TIMEOUT_CODES = new Set(["TIMEOUT", "MAX_STEPS_EXCEEDED"]);

function isEmptyResult(result: unknown): boolean {
  if (result === null || result === undefined) return true;
  if (typeof result === "object" && !Array.isArray(result)) return Object.keys(result as object).length === 0;
  return false;
}

function toOutcome<T>(run: RunResult, parse?: (r: unknown) => T): AgentOutcome<T> {
  const runId = run.run_id ?? null;
  if (run.status !== "COMPLETED") {
    const code = run.error?.code ?? run.status;
    return { status: TIMEOUT_CODES.has(code) ? "timeout" : "error", result: null, runId, error: code };
  }
  if (isEmptyResult(run.result)) return { status: "not_found", result: null, runId };
  if (!parse) return { status: "ok", result: run.result as T, runId };
  try {
    return { status: "ok", result: parse(run.result), runId };
  } catch {
    return { status: "error", result: null, runId, error: "invalid_result" };
  }
}

async function runSync(body: unknown, signal: AbortSignal): Promise<RunResult | "fallback" | { httpStatus: number }> {
  const res = await fetch(`${AGENT_URL}/automation/run`, { method: "POST", headers: headers(true), body: JSON.stringify(body), signal });
  // Only fall back when the endpoint itself is unavailable: then no run started and no credit was spent.
  if (res.status === 404 || res.status === 405) return "fallback";
  if (!res.ok) return { httpStatus: res.status };
  const parsed = RunResult.safeParse(await res.json().catch(() => null));
  return parsed.success ? parsed.data : { run_id: null, status: "FAILED", error: { code: "invalid_response" } };
}

async function runSse(
  body: unknown,
  signal: AbortSignal,
  onProgress?: (purpose: string) => void,
): Promise<RunResult | { httpStatus: number }> {
  const res = await fetch(`${AGENT_URL}/automation/run-sse`, {
    method: "POST",
    headers: { ...headers(true), Accept: "text/event-stream" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) return { httpStatus: res.status };
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  let runId: string | null = null;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const block = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        for (const line of block.split("\n")) {
          if (!line.startsWith("data:")) continue;
          let event: { type?: string; run_id?: string; purpose?: string };
          try {
            event = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }
          if (event.run_id) runId = event.run_id;
          if (event.type === "PROGRESS" && event.purpose) onProgress?.(event.purpose);
          if (event.type === "COMPLETE") {
            const parsed = RunResult.safeParse({ ...event, run_id: event.run_id ?? runId });
            return parsed.success ? parsed.data : { run_id: runId, status: "FAILED", error: { code: "invalid_event" } };
          }
        }
      }
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return { run_id: runId, status: "FAILED", error: { code: "stream_ended" } };
}

/**
 * Runs a browser agent on `url` with a natural-language `goal` and returns its structured result.
 * Never throws for an expected failure (site blocked, timeout, nothing found, credit guard): the caller gets a
 * status per source and can still return partial results (SPEC §0).
 */
export async function runAgent<T = unknown>(params: AgentParams<T>, opts?: CallOptions): Promise<AgentOutcome<T>> {
  if (isMock()) {
    if (params.mockResult === undefined) return { status: "not_found", result: null, runId: null };
    return toOutcome({ run_id: null, status: "COMPLETED", result: params.mockResult }, params.parse);
  }
  if (!takeAgentSlot()) {
    log({ event: "tinyfish_credit_guard", limit_per_minute: AGENT_CALLS_PER_MINUTE });
    return { status: "error", result: null, runId: null, error: "credit_guard" };
  }

  const timeoutMs = opts?.timeoutMs ?? TIMEOUTS.agent;
  // Stop the remote run when we stop waiting, so a slow site doesn't keep spending credits.
  const body = agentBody(params, Math.ceil(timeoutMs / 1000));
  const signal = AbortSignal.timeout(timeoutMs);
  count(opts);
  const started = Date.now();
  let outcome: AgentOutcome<T>;
  try {
    let run: RunResult | "fallback" | { httpStatus: number } = params.onProgress ? "fallback" : await runSync(body, signal);
    if (run === "fallback") run = await runSse(body, signal, params.onProgress);
    outcome =
      "httpStatus" in run
        ? { status: "error", result: null, runId: null, error: `http_${run.httpStatus}` }
        : toOutcome(run, params.parse);
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    outcome =
      name === "TimeoutError" || name === "AbortError"
        ? { status: "timeout", result: null, runId: null, error: "client_timeout" }
        : { status: "error", result: null, runId: null, error: "network" };
  }
  log({
    event: "tinyfish_agent",
    host: new URL(params.url).hostname,
    status: outcome.status,
    error: outcome.error,
    run_id: outcome.runId,
    duration_ms: Date.now() - started,
  });
  return outcome;
}

// ---------------------------------------------------------------- Async agent runs (paid)

export type RunStatus = "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";

export interface RunState {
  status: RunStatus;
  result: unknown;
  /** TinyFish error code when the run failed. */
  error: string | null;
  /** When the run left the queue (ms since epoch); null while PENDING. Runs queue when the account's browser limit is reached. */
  startedAt: number | null;
}

export type StartOutcome = { status: "started"; runId: string } | { status: "error"; error: string };

/** Mock mode: results of runs "started" in this process, keyed by run id. */
const mockRuns = new Map<string, unknown>();

function agentBody(params: Pick<AgentParams<unknown>, "url" | "goal" | "output_schema" | "browser_profile">, maxSeconds: number) {
  return {
    url: params.url,
    goal: params.goal,
    ...(params.output_schema ? { output_schema: params.output_schema } : {}),
    browser_profile: params.browser_profile ?? "lite",
    agent_config: { max_duration_seconds: maxSeconds },
  };
}

/**
 * Starts an agent run and returns its id at once (`run-async`), so no request has to wait for a slow site.
 * Read it later with `getRun()`. Counts against the credit guard. Never throws for an expected failure.
 */
export async function startAgent(
  params: Pick<AgentParams<unknown>, "url" | "goal" | "output_schema" | "browser_profile" | "mockResult"> & { maxSeconds: number },
  opts?: CallOptions,
): Promise<StartOutcome> {
  if (isMock()) {
    const runId = `mock-run-${crypto.randomUUID()}`;
    mockRuns.set(runId, params.mockResult ?? null);
    return { status: "started", runId };
  }
  if (!takeAgentSlot()) {
    log({ event: "tinyfish_credit_guard", limit_per_minute: AGENT_CALLS_PER_MINUTE });
    return { status: "error", error: "credit_guard" };
  }
  count(opts);
  try {
    const pool = apiKeys().length;
    const first = nextKey++ % pool; // rotate: each new run starts on the next key
    let res: Response | undefined;
    let used = first;
    // Out of credits (402) or rate limited (429) on one key: try the next one before giving up.
    for (let attempt = 0; attempt < pool; attempt++) {
      used = (first + attempt) % pool;
      res = await fetch(`${AGENT_URL}/automation/run-async`, {
        method: "POST",
        headers: headers(true, used),
        body: JSON.stringify(agentBody(params, params.maxSeconds)),
        signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUTS.monitor),
      });
      if (res.status !== 402 && res.status !== 429) break;
      log({ event: "tinyfish_key_skipped", status: res.status, key: used });
    }
    if (!res || !res.ok) {
      log({ event: "tinyfish_http_error", api: "run-async", status: res?.status });
      return { status: "error", error: `http_${res?.status}` };
    }
    const body = z.object({ run_id: z.string().nullable(), error: RunError }).safeParse(await res.json().catch(() => null));
    if (!body.success || !body.data.run_id) return { status: "error", error: body.success ? (body.data.error?.code ?? "no_run_id") : "invalid_response" };
    log({ event: "tinyfish_agent_started", host: new URL(params.url).hostname, run_id: body.data.run_id, key: used });
    return { status: "started", runId: pool > 1 ? `${used}~${body.data.run_id}` : body.data.run_id };
  } catch (err) {
    return { status: "error", error: err instanceof Error && err.name === "TimeoutError" ? "client_timeout" : "network" };
  }
}

const RunStateResponse = z.object({
  status: z.enum(["PENDING", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"]),
  result: z.unknown().optional(),
  error: RunError,
  started_at: z.string().nullable().optional(),
});

function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
}

/** Current state of a run. A network or HTTP problem is reported as still RUNNING, so the caller simply asks again. */
export async function getRun(runId: string, opts?: CallOptions): Promise<RunState> {
  if (isMock()) {
    if (!mockRuns.has(runId)) return { status: "FAILED", result: null, error: "unknown_run", startedAt: null };
    return { status: "COMPLETED", result: mockRuns.get(runId), error: null, startedAt: Date.now() };
  }
  count(opts);
  try {
    const { key, id } = splitRunId(runId);
    const res = await fetch(`${AGENT_URL}/runs/${encodeURIComponent(id)}`, {
      headers: headers(false, key),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUTS.monitor),
    });
    if (res.status === 404) return { status: "FAILED", result: null, error: "unknown_run", startedAt: null };
    if (!res.ok) {
      log({ event: "tinyfish_http_error", api: "runs", status: res.status });
      return { status: "RUNNING", result: null, error: null, startedAt: null };
    }
    const parsed = RunStateResponse.safeParse(await res.json().catch(() => null));
    if (!parsed.success) return { status: "RUNNING", result: null, error: null, startedAt: null };
    return {
      status: parsed.data.status,
      result: parsed.data.result ?? null,
      error: parsed.data.error?.code ?? null,
      startedAt: toMs(parsed.data.started_at),
    };
  } catch {
    return { status: "RUNNING", result: null, error: null, startedAt: null };
  }
}

/** Asks TinyFish to stop a run (best effort; a run that already finished stays finished). */
export async function cancelRun(runId: string, opts?: CallOptions): Promise<void> {
  if (isMock()) return;
  count(opts);
  try {
    const { key, id } = splitRunId(runId);
    await fetch(`${AGENT_URL}/runs/${encodeURIComponent(id)}/cancel`, {
      method: "POST",
      headers: headers(false, key),
      signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUTS.monitor),
    });
  } catch {
    // The run also stops by itself at max_duration_seconds.
  }
}

// ---------------------------------------------------------------- Monitor (paid per run)

export interface SearchMonitorParams {
  name: string;
  query: string;
  /** Five-field cron, UTC unless prefixed with CRON_TZ=…; runs must be ≥ 30 min apart. */
  schedule_cron: string;
  recency_minutes?: number;
  result_limit?: number;
  purpose?: string;
  webhook_url?: string;
}

const MonitorCreated = z.object({ monitor: z.object({ id: z.string(), status: z.string().optional() }) });

/** Creates a Topic Monitor (repeated search) that posts new results to `webhook_url`. Returns its id. */
export async function createSearchMonitor(params: SearchMonitorParams, opts?: CallOptions): Promise<{ id: string }> {
  if (isMock()) return { id: "mock-search-monitor" };
  count(opts);
  const res = await fetch(`${AGENT_URL}/monitors`, {
    method: "POST",
    headers: headers(true),
    body: JSON.stringify({
      type: "search",
      name: params.name,
      config: {
        query: params.query,
        ...(params.recency_minutes ? { recency_minutes: params.recency_minutes } : {}),
        ...(params.result_limit ? { result_limit: params.result_limit } : {}),
      },
      schedule_cron: params.schedule_cron,
      ...(params.purpose ? { purpose: params.purpose } : {}),
      ...(params.webhook_url ? { webhook_url: params.webhook_url } : {}),
    }),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUTS.monitor),
  });
  if (!res.ok) throw httpFailure("monitor", res.status);
  const parsed = MonitorCreated.safeParse(await res.json().catch(() => null));
  if (!parsed.success) throw invalidResponse("monitor");
  return { id: parsed.data.monitor.id };
}

/** Deletes a Monitor and its schedule (cleanup for scripts and tests). */
export async function deleteMonitor(id: string, opts?: CallOptions): Promise<void> {
  if (isMock()) return;
  count(opts);
  const res = await fetch(`${AGENT_URL}/monitors/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: headers(false),
    signal: AbortSignal.timeout(opts?.timeoutMs ?? TIMEOUTS.monitor),
  });
  if (!res.ok && res.status !== 404) throw httpFailure("monitor", res.status);
}
