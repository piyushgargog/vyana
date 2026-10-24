import { describe, expect, it, vi } from "vitest";

import { emergencyNearbyMock, shareMock } from "../mocks";
import { ApiError, createApiClient, type ApiClientOptions } from "./client";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function client(fetchImpl: ApiClientOptions["fetch"], token: string | null = "tok-123") {
  return createApiClient({ baseUrl: "https://api.example.com/", getAccessToken: async () => token, fetch: fetchImpl });
}

describe("createApiClient", () => {
  it("posts JSON with the bearer token and returns the validated response", async () => {
    const fetchMock = vi.fn(async () => json(200, emergencyNearbyMock));
    const res = await client(fetchMock).emergency.nearby({ lat: 28.6358, lng: 77.2945 });

    expect(res).toEqual(emergencyNearbyMock);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/emergency/nearby");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
    expect(JSON.parse(init.body as string)).toEqual({ lat: 28.6358, lng: 77.2945 });
  });

  it("omits the Authorization header when signed out", async () => {
    const fetchMock = vi.fn(async () => json(200, emergencyNearbyMock));
    await client(fetchMock, null).emergency.nearby({ lat: 28.6358, lng: 77.2945 });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("maps a server error body to ApiError", async () => {
    const fetchMock = vi.fn(async () => json(504, { error: { code: "UPSTREAM_TIMEOUT", message: "The map service took too long" } }));
    await expect(client(fetchMock).emergency.nearby({ lat: 28.6358, lng: 77.2945 })).rejects.toMatchObject({
      name: "ApiError", code: "UPSTREAM_TIMEOUT", message: "The map service took too long", status: 504,
    });
  });

  it("falls back to a code from the HTTP status when the error body is not JSON", async () => {
    const fetchMock = vi.fn(async () => new Response("<html>Unauthorized</html>", { status: 401 }));
    await expect(client(fetchMock).emergency.nearby({ lat: 28.6358, lng: 77.2945 })).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("rejects a response that does not match the schema", async () => {
    const fetchMock = vi.fn(async () => json(200, { query: "dolo 650" }));
    await expect(client(fetchMock).emergency.nearby({ lat: 28.6358, lng: 77.2945 })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("reports network failures as NETWORK_ERROR", async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    const err = await client(fetchMock).emergency.nearby({ lat: 28.6358, lng: 77.2945 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });

  it("validates the request before sending it", async () => {
    const fetchMock = vi.fn();
    await expect(client(fetchMock).emergency.nearby({ lat: 128.6, lng: 77.2945 })).rejects.toMatchObject({ code: "BAD_REQUEST", status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a copy of the fixture in mock mode without calling fetch", async () => {
    const fetchMock = vi.fn();
    const api = createApiClient({ baseUrl: "", getAccessToken: async () => null, useMocks: true, mockDelayMs: [0, 0], fetch: fetchMock });
    const res = await api.emergency.nearby({ lat: 28.6358, lng: 77.2945 });

    expect(res).toEqual(emergencyNearbyMock);
    expect(res).not.toBe(emergencyNearbyMock);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("retires the routeless plans and AI-usage paths (#530): no such client surface", () => {
    const api = client(vi.fn());
    const surface = api as unknown as Record<string, unknown>;
    expect("plans" in surface).toBe(false);
    expect("aiUsage" in surface).toBe(false);
  });

  it("trims any number of trailing slashes from the base URL", () => {
    const api = createApiClient({ baseUrl: "https://api.example.com///", getAccessToken: async () => null });
    expect(api.chatUrl).toBe("https://api.example.com/api/assistant/chat");
  });

  it("exposes the chat URL and auth headers for the chat transport", async () => {
    const api = client(vi.fn());
    expect(api.chatUrl).toBe("https://api.example.com/api/assistant/chat");
    await expect(api.authHeaders()).resolves.toEqual({ Authorization: "Bearer tok-123" });
  });

  it("reads a share link with GET, an encoded token and NO auth header", async () => {
    const fetchMock = vi.fn(async () => json(200, shareMock));
    await client(fetchMock).share.get("ab/c d");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/share/ab%2Fc%20d");
    expect(init.method).toBe("GET");
    expect(init.body).toBeUndefined();
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("rejects an empty share token without calling the server", async () => {
    const fetchMock = vi.fn();
    await expect(client(fetchMock).share.get("  ")).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("deletes the account with DELETE + auth and expects {ok:true}", async () => {
    const fetchMock = vi.fn(async () => json(200, { ok: true }));
    await expect(client(fetchMock).me.deleteAccount()).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/me");
    expect(init.method).toBe("DELETE");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
  });

  it("exports data with GET + auth", async () => {
    const fetchMock = vi.fn(async () => json(200, { profiles: [{ id: "x" }] }));
    await expect(client(fetchMock).me.exportData()).resolves.toEqual({ profiles: [{ id: "x" }] });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(init.method).toBe("GET");
  });

  it("handles 429 RATE_LIMITED with Retry-After header and triggers onRateLimit", async () => {
    const onRateLimitMock = vi.fn();
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { code: "RATE_LIMITED", message: "Too many requests" } }),
          { status: 429, headers: { "Content-Type": "application/json", "Retry-After": "180" } },
        ),
    );
    const testClient = createApiClient({
      baseUrl: "https://api.example.com",
      getAccessToken: async () => "tok-123",
      fetch: fetchMock,
      onRateLimit: onRateLimitMock,
    });

    const err = await testClient.emergency.nearby({ lat: 28.6358, lng: 77.2945 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
      retryAfterSeconds: 180,
      message: "Too many requests. Try again in 3 minutes.",
    });
    expect(onRateLimitMock).toHaveBeenCalledWith({
      message: "Too many requests. Try again in 3 minutes.",
      retryAfterSeconds: 180,
    });
  });

  it("handles 429 RATE_LIMITED without Retry-After header gracefully", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ error: { code: "RATE_LIMITED", message: "Server rate limit" } }),
          { status: 429, headers: { "Content-Type": "application/json" } },
        ),
    );
    const err = await client(fetchMock).emergency.nearby({ lat: 28.6358, lng: 77.2945 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      code: "RATE_LIMITED",
      status: 429,
      retryAfterSeconds: undefined,
      message: "Server rate limit",
    });
  });
});
