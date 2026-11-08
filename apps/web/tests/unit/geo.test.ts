import { afterEach, describe, expect, it, vi } from "vitest";
import { reverseGeocode } from "@/lib/server/geo";

describe("reverseGeocode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("names the area from Nominatim with an identifying User-Agent", async () => {
    vi.stubEnv("WEB_MOCK", "0");
    const fetchMock = vi.fn(async () => Response.json({ address: { suburb: "Preet Vihar", city: "Delhi", postcode: "110092" } }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await reverseGeocode(28.64, 77.29)).toBe("Preet Vihar, Delhi");
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toContain("nominatim.openstreetmap.org/reverse");
    expect((init.headers as Record<string, string>)["User-Agent"]).toBe("vyana-health/1.0");
  });

  it("returns null on failure and makes no call in mock mode", async () => {
    vi.stubEnv("WEB_MOCK", "0");
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("offline"); }));
    expect(await reverseGeocode(0, 0)).toBeNull();
    vi.stubEnv("WEB_MOCK", "1");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await reverseGeocode(28.6, 77.2)).toBe("[mock] Preet Vihar, Delhi");
    expect(spy).not.toHaveBeenCalled();
  });

  it("returns null when the Nominatim answer is over the cap", async () => {
    vi.stubEnv("WEB_MOCK", "0");
    const huge = JSON.stringify({ address: { suburb: "Preet Vihar", city: "Delhi" }, padding: "x".repeat(200_000) });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(huge, { status: 200, headers: { "content-type": "application/json" } })));
    expect(await reverseGeocode(28.64, 77.29)).toBeNull();
  });
});
