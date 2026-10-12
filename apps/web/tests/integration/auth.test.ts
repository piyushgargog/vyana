import { describe, expect, it, vi } from "vitest";
import { ApiErrorBody } from "@vyana/shared";

// Supabase is mocked: tests never touch the network (tests/README.md).
const VALID = "valid-access-token";
const USER_ID = "3f1b6c2e-8a4d-4e7b-9c1a-2d5e6f7a8b9c";
const profiles: Record<string, { id: string; role: string; full_name: string }> = {
  [USER_ID]: { id: USER_ID, role: "patient", full_name: "Demo Patient" },
};

vi.mock("@/lib/server/supabase-admin", () => ({
  supabaseAdmin: () => ({
    auth: {
      getUser: async (token: string) =>
        token === VALID
          ? { data: { user: { id: USER_ID, email: "patient@vyana.test" } }, error: null }
          : { data: { user: null }, error: new Error("invalid JWT") },
    },
  }),
  supabaseForUser: () => ({
    from: () => {
      let id = "";
      const chain = {
        select: () => chain,
        eq: (_col: string, value: string) => ((id = value), chain),
        maybeSingle: async () => ({ data: profiles[id] ?? null, error: null }),
      };
      return chain;
    },
  }),
}));

const { withRoute } = await import("@/lib/server/errors");
const { requireRole, requireUser } = await import("@/lib/server/auth");

// A minimal route built the same way every real route is.
const GET = withRoute("test/me", async (req, ctx) => {
  const { user, profile } = await requireUser(req);
  ctx.userId = user.id;
  return Response.json({ id: profile.id, role: profile.role });
});

const DOCTOR_ONLY = withRoute("test/doctor", async (req) => {
  const { profile } = await requireUser(req);
  requireRole(profile, "doctor");
  return Response.json({ ok: true });
});

const request = (authorization?: string) =>
  new Request("http://localhost/api/test", { headers: authorization ? { authorization } : {} });

describe("requireUser", () => {
  it("returns the caller's profile for a valid token", async () => {
    const res = await GET(request(`Bearer ${VALID}`), undefined);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: USER_ID, role: "patient" });
  });

  it("rejects a missing token with 401", async () => {
    const res = await GET(request(), undefined);
    expect(res.status).toBe(401);
    expect(ApiErrorBody.parse(await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("rejects an invalid token with 401", async () => {
    const res = await GET(request("Bearer forged-token"), undefined);
    expect(res.status).toBe(401);
    expect(ApiErrorBody.parse(await res.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("rejects a non-bearer scheme with 401", async () => {
    const res = await GET(request(`Basic ${VALID}`), undefined);
    expect(res.status).toBe(401);
  });
});

describe("requireRole", () => {
  it("rejects the wrong role with 403", async () => {
    const res = await DOCTOR_ONLY(request(`Bearer ${VALID}`), undefined);
    expect(res.status).toBe(403);
    expect(ApiErrorBody.parse(await res.json()).error.code).toBe("FORBIDDEN");
  });
});
