import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiErrorBody, JoinWaitlistRes } from "@vyana/shared";

const rpc = vi.fn();

// Supabase is mocked: tests never touch the network (tests/README.md). Only the rpc the route
// calls is faked; the join_waitlist() function itself is covered by supabase/tests/database/plans.test.sql.
vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => ({ rpc }),
  requireEnv: (name: string) => process.env[name] ?? "",
}));

const { POST } = await import("@/app/api/waitlist/route");

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/waitlist", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    undefined,
  );

beforeEach(() => {
  rpc.mockReset().mockResolvedValue({ data: true, error: null });
});

describe("POST /api/waitlist", () => {
  it("joins a new email to the Family list, with no sign-in", async () => {
    const res = await post({ email: "family@example.com", note: "for my parents" });
    expect(res.status).toBe(200);
    expect(JoinWaitlistRes.parse(await res.json())).toEqual({ status: "joined" });
    expect(rpc).toHaveBeenCalledExactlyOnceWith("join_waitlist", {
      p_email: "family@example.com",
      p_plan_id: "family",
      p_note: "for my parents",
    });
  });

  it("answers already_on_list when the email is already on the list, and never asks twice", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const res = await post({ email: "family@example.com" });
    expect(res.status).toBe(200);
    expect(JoinWaitlistRes.parse(await res.json())).toEqual({ status: "already_on_list" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("answers 400 for a bad email or a note over 200 characters, without touching the database", async () => {
    for (const body of [{ email: "not-an-email" }, { email: "a@b.co", note: "x".repeat(201) }, {}]) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(ApiErrorBody.parse(await res.json()).error.code).toBe("BAD_REQUEST");
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("answers 429 when the database function says the anonymous joins are over the limit", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "join_waitlist: rate limited, try again later", code: "P0001", details: null },
    });
    const res = await post({ email: "family@example.com" });
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("3600");
    expect(ApiErrorBody.parse(await res.json()).error).toEqual({
      code: "RATE_LIMITED",
      message: "You've reached the limit for now. Try again in 60 minutes.",
    });
  });

  it("answers a plain 500, with nothing from the database in it, when the join itself fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "relation \"waitlist\" does not exist", code: "42P01", details: "schema public" } });
    const res = await post({ email: "family@example.com" });
    expect(res.status).toBe(500);
    expect(ApiErrorBody.parse(await res.json()).error).toEqual({
      code: "INTERNAL",
      message: "The request could not be finished. Please try again.",
    });
  });
});
