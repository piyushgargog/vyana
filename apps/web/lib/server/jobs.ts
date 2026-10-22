import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { TTL, cached } from "./cache";
import { notFound } from "./errors";
import { requireEnv } from "./supabase-admin";
import type { CallCounter, RunState } from "./tinyfish/client";

/**
 * Job tokens (ADR-035): the state of a background job travels inside its id, encrypted and signed with
 * AES-256-GCM, so we need no job table and the contents (e.g. medicine names) are never readable in a URL or log.
 * A token that was altered, or made with another secret, fails to open.
 */

const VERSION = "v1";

function key(): Buffer {
  const secret = requireEnv("JOB_TOKEN_SECRET");
  if (secret.length < 32) throw new Error("JOB_TOKEN_SECRET must be at least 32 characters");
  return createHash("sha256").update(secret).digest();
}

export function sealJob(payload: unknown): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${VERSION}.${Buffer.concat([iv, tag, data]).toString("base64url")}`;
}

/** Returns the payload, or null when the token is malformed, altered or from another secret. */
export function openJob(token: string): unknown | null {
  const [version, body] = token.split(".");
  if (version !== VERSION || !body) return null;
  try {
    const raw = Buffer.from(body, "base64url");
    if (raw.length < 12 + 16 + 1) return null;
    const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const json = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------- polling a job

/**
 * TinyFish queues runs beyond the account's browser limit (2 at once on our plan, measured 12 Oct), so a run may
 * wait for another job to finish before it starts. Every agent job gives a queued run this long from the job's
 * start. The deadline counts only the wait: once a run has started, its own run deadline is the one that applies,
 * however long it waited (timing a started run out by the job's age cancelled healthy runs, fixed in #368).
 */
export const QUEUE_DEADLINE_MS = 480_000;

/**
 * The run deadline of a single-task agent: its 150 s cap plus 40 s of grace. This is a deliberate per-job
 * difference, not a shared rule — a job whose agent does more work (the basket, one run per pharmacy pricing
 * every item) passes its own scaled deadline to `pollAgentRun` instead of this one.
 */
export const FLAT_RUN_DEADLINE_MS = 190_000;

/** Every job poll starts the same way: open the token, check the job belongs to the caller, else not found. */
export function openJobForUser<S extends z.ZodTypeAny>(schema: S, token: string, uid: string, notFoundMessage: string): z.infer<S> {
  const parsed = schema.safeParse(openJob(token));
  if (!parsed.success || (parsed.data as { uid?: unknown }).uid !== uid) throw notFound(notFoundMessage);
  return parsed.data;
}

/** The finished result a job with no runs points at, or the job has expired. */
export async function cachedJobResult<T>(key: string, kind: string, expiredMessage: string): Promise<T> {
  const hit = await cached<T>(key, kind, TTL.day, async () => null);
  if (!hit) throw notFound(expiredMessage);
  return hit.value;
}

/** Stores a job's finished result under its key, where the next identical request finds it. */
export async function cacheJobResult<T>(key: string, kind: string, result: T): Promise<void> {
  await cached<T>(key, kind, TTL.day, async () => result);
}

export type AgentRunPollState = "completed" | "pending" | "timeout" | "error";

/**
 * One run's poll decision, shared by every agent job: a finished run is processed, a failed one maps its error
 * (a provider timeout, an exhausted step budget and a cancellation all read as "timeout"), and a run that is
 * still going is cancelled once it passes a deadline — the run deadline once it has started, the queue
 * deadline while it has not.
 */
export function agentRunPollDecision(
  run: RunState,
  opts: { jobStartedAt: number; runDeadlineMs: number; queueDeadlineMs?: number; now?: number },
): { state: AgentRunPollState; cancel: boolean } {
  if (run.status === "COMPLETED") return { state: "completed", cancel: false };
  if (run.status === "FAILED" || run.status === "CANCELLED") {
    const state = run.error === "TIMEOUT" || run.error === "MAX_STEPS_EXCEEDED" || run.status === "CANCELLED" ? "timeout" : "error";
    return { state, cancel: false };
  }
  const now = opts.now ?? Date.now();
  const stuckRunning = run.status === "RUNNING" && run.startedAt !== null && now - run.startedAt > opts.runDeadlineMs;
  const stuckQueued = run.startedAt === null && now - opts.jobStartedAt > (opts.queueDeadlineMs ?? QUEUE_DEADLINE_MS);
  return stuckRunning || stuckQueued ? { state: "timeout", cancel: true } : { state: "pending", cancel: false };
}

export type PollAgentRunOutcome<T> =
  | { state: "completed"; value: T }
  | { state: Exclude<AgentRunPollState, "completed">; value: null };

/**
 * Polls one agent run of a job: a run whose processed result is already cached answers from the cache, a
 * completed run is processed once (by the caller's `processResult`) and cached, and an unfinished run reports
 * its state. The caller keeps only what is its own: which run deadline its job type uses, and how a finished
 * run's raw result becomes its answer.
 */
export async function pollAgentRun<T>(opts: {
  runId: string;
  cacheKey: string;
  cacheKind: string;
  jobStartedAt: number;
  /** This job type's run deadline — an explicit choice per job (see FLAT_RUN_DEADLINE_MS). */
  runDeadlineMs: number;
  queueDeadlineMs?: number;
  counter?: CallCounter;
  getRun: (runId: string, opts?: { counter?: CallCounter }) => Promise<RunState>;
  cancelRun: (runId: string, opts?: { counter?: CallCounter }) => Promise<void>;
  processResult: (result: unknown) => Promise<T>;
}): Promise<PollAgentRunOutcome<T>> {
  let state: Exclude<AgentRunPollState, "completed"> = "pending";
  const done = await cached<T>(opts.cacheKey, opts.cacheKind, TTL.day, async () => {
    const run = await opts.getRun(opts.runId, { counter: opts.counter });
    const decision = agentRunPollDecision(run, {
      jobStartedAt: opts.jobStartedAt,
      runDeadlineMs: opts.runDeadlineMs,
      queueDeadlineMs: opts.queueDeadlineMs,
    });
    if (decision.state === "completed") return opts.processResult(run.result);
    if (decision.cancel) await opts.cancelRun(opts.runId, { counter: opts.counter });
    state = decision.state;
    return null;
  });
  return done ? { state: "completed", value: done.value } : { state, value: null };
}
