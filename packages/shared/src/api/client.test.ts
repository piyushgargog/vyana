import { describe, expect, it, vi } from "vitest";

import { basketCompareMock, medicinesCompareMock, shareMock } from "../mocks";
import { ApiError, createApiClient, type ApiClientOptions } from "./client";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function client(fetchImpl: ApiClientOptions["fetch"], token: string | null = "tok-123") {
  return createApiClient({ baseUrl: "https://api.example.com/", getAccessToken: async () => token, fetch: fetchImpl });
}

describe("createApiClient", () => {
  it("posts JSON with the bearer token and returns the validated response", async () => {
    const fetchMock = vi.fn(async () => json(200, medicinesCompareMock));
    const res = await client(fetchMock).medicines.compare({ medicine: "Dolo", strength: "650" });

    expect(res).toEqual(medicinesCompareMock);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/medicines/compare");
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
    expect(JSON.parse(init.body as string)).toEqual({ medicine: "Dolo", strength: "650" });
  });

  it("omits the Authorization header when signed out", async () => {
    const fetchMock = vi.fn(async () => json(200, medicinesCompareMock));
    await client(fetchMock, null).medicines.compare({ medicine: "Dolo" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("maps a server error body to ApiError", async () => {
    const fetchMock = vi.fn(async () => json(504, { error: { code: "UPSTREAM_TIMEOUT", message: "Pharmacies took too long" } }));
    await expect(client(fetchMock).medicines.compare({ medicine: "Dolo" })).rejects.toMatchObject({
      name: "ApiError", code: "UPSTREAM_TIMEOUT", message: "Pharmacies took too long", status: 504,
    });
  });

  it("falls back to a code from the HTTP status when the error body is not JSON", async () => {
    const fetchMock = vi.fn(async () => new Response("<html>Unauthorized</html>", { status: 401 }));
    await expect(client(fetchMock).alerts.check()).rejects.toMatchObject({ code: "UNAUTHORIZED", status: 401 });
  });

  it("rejects a response that does not match the schema", async () => {
    const fetchMock = vi.fn(async () => json(200, { query: "dolo 650" }));
    await expect(client(fetchMock).medicines.compare({ medicine: "Dolo" })).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("reports network failures as NETWORK_ERROR", async () => {
    const fetchMock = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    const err = await client(fetchMock).medicines.compare({ medicine: "Dolo" }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ code: "NETWORK_ERROR", status: 0 });
  });

  it("validates the request before sending it", async () => {
    const fetchMock = vi.fn();
    await expect(client(fetchMock).medicines.compare({ medicine: "D" })).rejects.toMatchObject({ code: "BAD_REQUEST", status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a copy of the fixture in mock mode without calling fetch", async () => {
    const fetchMock = vi.fn();
    const api = createApiClient({ baseUrl: "", getAccessToken: async () => null, useMocks: true, mockDelayMs: [0, 0], fetch: fetchMock });
    const res = await api.medicines.compare({ medicine: "Dolo 650" });

    expect(res).toEqual(medicinesCompareMock);
    expect(res).not.toBe(medicinesCompareMock);
    expect(fetchMock).not.toHaveBeenCalled();
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

  it("posts a basket compare request and validates the response", async () => {
    const fetchMock = vi.fn(async () => json(200, basketCompareMock));
    const res = await client(fetchMock).basket.compare({ prescription_id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4" });
    expect(res.cheapest_source).toBe("pharmeasy");
    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.example.com/api/prescriptions/basket");
  });

  it("rejects a basket request with both prescription_id and items before sending", async () => {
    const fetchMock = vi.fn();
    await expect(
      client(fetchMock).basket.compare({ prescription_id: "28d7de60-7dd9-4769-98ec-a26bfdfaa7a4", items: [{ medicine: "Dolo" }] }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(fetchMock).not.toHaveBeenCalled();
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
});
