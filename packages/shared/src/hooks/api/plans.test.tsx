// @vitest-environment jsdom
import { QueryClient } from "@tanstack/react-query";
import { act, cleanup, configure, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { fakeSupabase, type FakeResult } from "../../db/queries/fakeSupabase";
import { AppProviders } from "../../providers/AppProviders";
import { useJoinWaitlistPage } from "./plans";

// The plans page submits the waitlist form signed out; the join must reach the
// database function, never the API route (POST /api/waitlist was never built).
configure({ asyncUtilTimeout: 8000 });
vi.setConfig({ testTimeout: 20000 });

const ok = (data: unknown): FakeResult => ({ data, error: null });

function setup(fake: ReturnType<typeof fakeSupabase>) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppProviders
      supabase={fake.sb as never}
      apiBaseUrl="https://vyana.app/"
      queryClient={queryClient}
    >
      {children}
    </AppProviders>
  );
  return { wrapper };
}

afterEach(() => cleanup());

describe("useJoinWaitlistPage", () => {
  it("joins the Family waitlist through the database function", async () => {
    const fake = fakeSupabase({
      userId: null,
      responses: { "rpc:join_waitlist": [ok(true)] },
    });
    const { wrapper } = setup(fake);
    const { result } = renderHook(() => useJoinWaitlistPage(), { wrapper });

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({
        email: "a@example.com",
        note: "hi",
      });
    });

    expect(res).toEqual({ status: "joined" });
    expect(fake.argsOf("rpc")).toEqual([
      "join_waitlist",
      { p_email: "a@example.com", p_plan_id: "family", p_note: "hi" },
    ]);
  });

  it("answers already_on_list when the address is already on the list", async () => {
    const fake = fakeSupabase({
      userId: null,
      responses: { "rpc:join_waitlist": [ok(false)] },
    });
    const { wrapper } = setup(fake);
    const { result } = renderHook(() => useJoinWaitlistPage(), { wrapper });

    let res: unknown;
    await act(async () => {
      res = await result.current.mutateAsync({ email: "a@example.com" });
    });

    expect(res).toEqual({ status: "already_on_list" });
  });

  it("rejects when the database function fails, instead of answering a status", async () => {
    const fake = fakeSupabase({
      userId: null,
      responses: {
        "rpc:join_waitlist": [{ data: null, error: { message: "boom", code: "XX000" } }],
      },
    });
    const { wrapper } = setup(fake);
    const { result } = renderHook(() => useJoinWaitlistPage(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({ email: "a@example.com" })
      ).rejects.toThrow("boom");
    });
    expect(result.current.data).toBeUndefined();
  });
});
