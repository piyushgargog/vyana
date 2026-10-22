import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db, fakeSupabaseModule, resetDb } from "../fixtures/fake-supabase";

vi.mock("@/lib/server/supabase-admin", () => fakeSupabaseModule);

const { findNearbyHospitals, haversineKm, parseOverpass } = await import("@/lib/server/web/overpass");

const FROM = { lat: 28.6139, lng: 77.209 };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const FIXTURE = {
  elements: [
    { type: "way", id: 456, center: { lat: 28.62, lon: 77.21 }, tags: { name: "Second Hospital", "addr:street": "Test Road", "addr:city": "Delhi" } },
    { type: "node", id: 123, lat: 28.6145, lon: 77.2095, tags: { name: "First Hospital", emergency: "yes", phone: "011 0000 0001" } },
    { type: "node", id: 789, lat: 28.61, lon: 77.2, tags: { amenity: "hospital" } },
  ],
};

beforeEach(() => {
  vi.stubEnv("WEB_MOCK", "0"); // the real path with a stubbed network
  resetDb();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("haversineKm", () => {
  it("is zero for the same point and about 111 km for one degree of latitude", () => {
    expect(haversineKm(FROM, FROM)).toBe(0);
    expect(haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111.19, 1);
  });
});

describe("parseOverpass", () => {
  it("keeps named hospitals, nearest first, and never claims what the map does not say", () => {
    const hospitals = parseOverpass(FIXTURE, FROM);
    expect(hospitals.map((h) => h.name)).toEqual(["First Hospital", "Second Hospital"]);
    expect(hospitals[0]).toMatchObject({ phone: "011 0000 0001", address: null, has_emergency: true, has_icu: null, source_url: "https://www.openstreetmap.org/node/123" });
    expect(hospitals[1]).toMatchObject({ phone: null, address: "Test Road, Delhi", has_emergency: null, has_icu: null, source_url: "https://www.openstreetmap.org/way/456" });
    expect(hospitals[0].maps_url.startsWith("https://www.google.com/maps/search/?api=1&query=")).toBe(true);
  });

  it("drops a second hospital with the same name (any case) and keeps at most 8", () => {
    const dup = { elements: [
      { type: "node", id: 1, lat: 28.61, lon: 77.21, tags: { name: "City Care" } },
      { type: "node", id: 2, lat: 28.62, lon: 77.21, tags: { name: "CITY CARE" } },
    ] };
    expect(parseOverpass(dup, FROM)).toHaveLength(1);
    const many = { elements: Array.from({ length: 12 }, (_, i) => ({ type: "node", id: i, lat: 28.6 + i / 1000, lon: 77.2, tags: { name: `Hospital ${i}` } })) };
    expect(parseOverpass(many, FROM)).toHaveLength(8);
  });

  it("answers an empty list for anything that is not an Overpass answer", () => {
    expect(parseOverpass(null, FROM)).toEqual([]);
    expect(parseOverpass({ elements: "x" }, FROM)).toEqual([]);
    expect(parseOverpass({ elements: [{ tags: { name: "No place" } }] }, FROM)).toEqual([]);
  });
});

describe("findNearbyHospitals", () => {
  it("asks Overpass once per ~1 km area, says who it is, and caches the answer", async () => {
    const fetchFn = vi.fn<typeof fetch>(async (url) => (String(url).includes("overpass") ? json(FIXTURE) : json({ address: { suburb: "Connaught Place", city: "Delhi" } })));
    vi.stubGlobal("fetch", fetchFn);
    const first = await findNearbyHospitals(28.6139, 77.209);
    expect(first.hospitals.map((h) => h.name)).toEqual(["First Hospital", "Second Hospital"]);
    expect(first.cached).toBe(false);
    const call = fetchFn.mock.calls.find(([u]) => String(u).includes("overpass"))!;
    expect((call[1]?.headers as Record<string, string>)["User-Agent"]).toContain("Vyana");
    const calls = fetchFn.mock.calls.length;
    const second = await findNearbyHospitals(28.6141, 77.2092);
    expect(second.cached).toBe(true);
    expect(fetchFn.mock.calls.length).toBe(calls);
  });

  it("falls back to the seeded table when Overpass answers 503", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async (url) => (String(url).includes("overpass") ? json({}, 503) : json({}))));
    db.rows.hospitals = [
      { name: "Table Far", address: "Far Road", phone: null, lat: 28.9, lng: 77.2 },
      { name: "Table Near", address: "Near Road", phone: "011 0000 0002", lat: 28.62, lng: 77.21 },
      { name: "Table Nowhere", address: null, phone: null, lat: null, lng: null },
      { name: "Table Other City", address: null, phone: null, lat: 19.07, lng: 72.87 },
    ];
    const res = await findNearbyHospitals(28.6139, 77.209);
    expect(res.hospitals.map((h) => h.name)).toEqual(["Table Near", "Table Far"]);
    expect(res.hospitals[0]).toMatchObject({ has_emergency: null, has_icu: null, source_url: null });
  });

  it("never throws: no map answer and an empty table give an empty list, which is not cached", async () => {
    vi.stubGlobal("fetch", vi.fn<typeof fetch>(async () => { throw new Error("network down"); }));
    db.rows.hospitals = [];
    expect(await findNearbyHospitals(12.97, 77.59)).toEqual({ area: null, hospitals: [], cached: false });
    expect(db.web_cache.size).toBe(0);
  });
});
