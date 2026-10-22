import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("server-only", () => ({}));

import { checkDailyAiLimit, enforceDailyAiLimit, secondsUntilIstMidnight } from "@/lib/server/entitlements";
import { AppError } from "@/lib/server/errors";

const fake = (limit: number | null, calls: number, fail = false) =>
  ({
    rpc: async (name: string) => {
      if (fail) return { data: null, error: { message: "x" } };
      return name === "current_plan"
        ? { data: [{ plan_id: "free", daily_ai_calls: limit }], error: null }
        : { data: [{ calls, input_tokens: 0, output_tokens: 0 }], error: null };
    },
  }) as unknown as SupabaseClient;

describe("secondsUntilIstMidnight", () => {
  it("is 60 at 23:59 IST", () => expect(secondsUntilIstMidnight(new Date("2026-10-22T18:29:00Z"))).toBe(60));
  it("is 86400 at exactly midnight IST", () => expect(secondsUntilIstMidnight(new Date("2026-10-22T18:30:00Z"))).toBe(86400));
  it("is never below 1", () => expect(secondsUntilIstMidnight(new Date("2026-10-22T18:29:59.999Z"))).toBeGreaterThanOrEqual(1));
});

describe("checkDailyAiLimit", () => {
  it("allows 29 of 30", async () => {
    await expect(checkDailyAiLimit(fake(30, 29))).resolves.toBeUndefined();
  });
  it("blocks 30 of 30 with 429 RATE_LIMITED", async () => {
    const err = await checkDailyAiLimit(fake(30, 30)).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(429);
    expect(err.code).toBe("RATE_LIMITED");
  });
  it("allows when there is no limit", async () => {
    await expect(checkDailyAiLimit(fake(null, 999))).resolves.toBeUndefined();
  });
  it("fails closed with a 429 when a call errors", async () => {
    const err = await checkDailyAiLimit(fake(30, 0, true)).catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.status).toBe(429);
    expect(err.code).toBe("RATE_LIMITED");
    expect(err.message).toBe("The daily AI limit could not be checked right now. Please try again in a little while.");
  });
  it("fails closed when there is no plan row", async () => {
    const sb = { rpc: async () => ({ data: [], error: null }) } as unknown as SupabaseClient;
    await expect(checkDailyAiLimit(sb)).rejects.toMatchObject({ status: 429 });
  });
});

describe("plans and roles", () => {
  it("lets the 31st call through on a family plan (150)", async () => {
    await expect(checkDailyAiLimit(fake(150, 30))).resolves.toBeUndefined();
  });
  it("fails closed when an rpc throws", async () => {
    const sb = {
      rpc: async () => {
        throw new Error("network");
      },
    } as unknown as SupabaseClient;
    await expect(checkDailyAiLimit(sb)).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED" });
  });
  it("does not limit or count a doctor or admin", async () => {
    for (const role of ["doctor", "admin"]) {
      const rpc = vi.fn(async () => ({ data: [{ daily_ai_calls: 30, calls: 999 }], error: null }));
      await expect(enforceDailyAiLimit({ profile: { role }, sb: { rpc } as unknown as SupabaseClient })).resolves.toBeUndefined();
      expect(rpc).not.toHaveBeenCalled();
    }
  });
  it("limits a patient", async () => {
    await expect(enforceDailyAiLimit({ profile: { role: "patient" }, sb: fake(30, 30) })).rejects.toMatchObject({ status: 429 });
  });
});
