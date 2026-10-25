import { describe, expect, it } from "vitest";
import { FLAT_RUN_DEADLINE_MS, QUEUE_DEADLINE_MS, agentRunPollDecision } from "@/lib/server/jobs";
import type { RunState } from "@/lib/server/tinyfish/client";

const NOW = Date.parse("2026-10-12T10:00:00Z");
const run = (partial: Partial<RunState>): RunState => ({ status: "PENDING", result: null, error: null, startedAt: null, ...partial });
const decide = (r: RunState, jobStartedAt: number) =>
  agentRunPollDecision(r, { jobStartedAt, runDeadlineMs: FLAT_RUN_DEADLINE_MS, now: NOW });

describe("agent run poll decision (shared by the basket and lab job pollers)", () => {
  it("processes a completed run and never cancels it", () => {
    expect(decide(run({ status: "COMPLETED" }), NOW - QUEUE_DEADLINE_MS * 2)).toEqual({ state: "completed", cancel: false });
  });

  it("maps a failed run by its error: provider timeouts read as timeout, the rest as error", () => {
    expect(decide(run({ status: "FAILED", error: "TIMEOUT", startedAt: NOW }), NOW)).toEqual({ state: "timeout", cancel: false });
    expect(decide(run({ status: "FAILED", error: "MAX_STEPS_EXCEEDED", startedAt: NOW }), NOW)).toEqual({ state: "timeout", cancel: false });
    expect(decide(run({ status: "FAILED", error: "SITE_BLOCKED", startedAt: NOW }), NOW)).toEqual({ state: "error", cancel: false });
    expect(decide(run({ status: "CANCELLED", startedAt: NOW }), NOW)).toEqual({ state: "timeout", cancel: false });
  });

  it("gives up on a run that waited in the queue past the queue deadline", () => {
    expect(decide(run({ status: "PENDING" }), NOW - QUEUE_DEADLINE_MS - 1000)).toEqual({ state: "timeout", cancel: true });
    expect(decide(run({ status: "PENDING" }), NOW - QUEUE_DEADLINE_MS + 1000)).toEqual({ state: "pending", cancel: false });
  });

  it("does not cancel on the queue deadline when the run's state is unknown", () => {
    // getRun answers a transient failure as RUNNING with no start time: that is an
    // unknown, not a queued run, so even a very old job must not cancel it.
    const unknown = run({ status: "RUNNING", startedAt: null });
    expect(decide(unknown, NOW - QUEUE_DEADLINE_MS * 3)).toEqual({ state: "pending", cancel: false });
  });

  it("does not time out a run that has started, however long it waited in the queue (#368)", () => {
    const started = run({ status: "RUNNING", startedAt: NOW - 10_000 });
    expect(decide(started, NOW - QUEUE_DEADLINE_MS - 20_000)).toEqual({ state: "pending", cancel: false });
  });

  it("times out a started run by its own deadline, counted from when it started", () => {
    const started = run({ status: "RUNNING", startedAt: NOW - FLAT_RUN_DEADLINE_MS - 1000 });
    expect(decide(started, NOW - 60_000)).toEqual({ state: "timeout", cancel: true });
  });
});
