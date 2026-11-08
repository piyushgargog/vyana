import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { bearerToken } from "@/lib/server/auth";
import { RECENT_LOGIN_MINUTES, requireRecentLogin } from "@/lib/server/data/account";

/** A token whose claims carry the given sign-in time, in seconds since 1970. */
const tokenWithSignIn = (secondsAgo: number) => {
  const now = Math.floor(Date.now() / 1000);
  const claims = { amr: [{ timestamp: now - secondsAgo }], iat: now - secondsAgo };
  return `h.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.s`;
};

const req = (authorization?: string) =>
  new Request(
    "https://vyana.test/api/me",
    authorization ? { headers: { authorization } } : {},
  );

describe("bearerToken", () => {
  it("returns the token of a bearer header", () => {
    expect(bearerToken(req("Bearer abc.def.ghi"))).toBe("abc.def.ghi");
  });

  it("accepts a lowercase scheme", () => {
    expect(bearerToken(req("bearer abc"))).toBe("abc");
  });

  it("returns null for another scheme, a bare scheme, or no header", () => {
    expect(bearerToken(req("Basic abc"))).toBeNull();
    expect(bearerToken(req("Bearer"))).toBeNull();
    expect(bearerToken(req())).toBeNull();
  });
});

describe("requireRecentLogin", () => {
  it("passes for a sign-in a minute ago", () => {
    expect(() => requireRecentLogin(req(`Bearer ${tokenWithSignIn(60)}`))).not.toThrow();
  });

  it("refuses a sign-in older than the recent-login window", () => {
    const stale = tokenWithSignIn((RECENT_LOGIN_MINUTES + 1) * 60);
    expect(() => requireRecentLogin(req(`Bearer ${stale}`))).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });

  it("refuses a request with no bearer token", () => {
    expect(() => requireRecentLogin(req())).toThrowError(expect.objectContaining({ status: 403 }));
    expect(() => requireRecentLogin(req("Basic abc"))).toThrowError(
      expect.objectContaining({ status: 403 }),
    );
  });
});
