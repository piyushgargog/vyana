import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn(async () => ({ data: { user: null }, error: null }));
const createServerClient = vi.fn(() => ({ auth: { getUser } }));
vi.mock("@supabase/ssr", () => ({ createServerClient }));

const { proxy } = await import("../../proxy");

const request = (headers: Record<string, string> = {}) => new NextRequest("https://vyanahealth.app/dashboard", { headers });

beforeEach(() => {
  getUser.mockClear();
  createServerClient.mockClear();
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
});

describe("proxy session refresh", () => {
  it("refreshes the session on a full page load", async () => {
    await proxy(request());
    expect(getUser).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["a link prefetch", { "next-router-prefetch": "1" }],
    ["a client-side navigation", { rsc: "1" }],
    ["a prefetch hint", { purpose: "prefetch" }],
  ])("does not refresh the session on %s (it would refresh the same token many times at once)", async (_name, headers) => {
    await proxy(request(headers));
    expect(createServerClient).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });
});
