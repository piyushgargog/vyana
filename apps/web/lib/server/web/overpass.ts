import "server-only";
import type { EmergencyNearbyRes, Hospital } from "@vyana/shared";
import { TTL, cached } from "../cache";
import { reverseGeocode } from "../geo";
import { log } from "../log";
import { supabaseAdmin } from "../supabase-admin";
import { isWebMock } from "./domains";

/**
 * Hospitals near a point (SPEC §5, ADR-072): one request to the public OpenStreetMap Overpass service (about a second),
 * with the seeded `hospitals` table as the fallback. Used by the SOS screen, so it never throws and never waits long.
 * OpenStreetMap does not say whether a hospital has an ICU, and only sometimes says it has an emergency department, so
 * those two fields are `null` unless the map says "yes": we never show a "no" we do not know.
 */

const ENDPOINT = "https://overpass-api.de/api/interpreter";
const USER_AGENT = "Vyana/1.2 (+https://vyanahealth.app; patient health app; nearby hospitals)";
const TIMEOUT_MS = 12_000;
const RADIUS_M = 5000;
const KEEP = 8;
const FALLBACK_KM = 60;

type Point = { lat: number; lng: number };

export function mapsUrl(name: string, address: string | null): string {
  const query = address ? `${name}, ${address}` : name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Great-circle distance in km. */
export function haversineKm(a: Point, b: Point): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

interface OsmElement {
  type?: string;
  id?: number;
  lat?: number;
  lon?: number;
  center?: { lat?: number; lon?: number };
  tags?: Record<string, unknown>;
}

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Pure: the Overpass answer to hospitals, nearest first, one per name, at most 8. */
export function parseOverpass(json: unknown, from: Point): Hospital[] {
  const elements = (json as { elements?: unknown } | null)?.elements;
  if (!Array.isArray(elements)) return [];
  const found: { hospital: Hospital; km: number }[] = [];
  for (const raw of elements as OsmElement[]) {
    const tags = raw?.tags ?? {};
    const name = text(tags.name);
    const lat = raw.lat ?? raw.center?.lat;
    const lng = raw.lon ?? raw.center?.lon;
    if (!name || typeof lat !== "number" || typeof lng !== "number") continue;
    const address = ["addr:housenumber", "addr:street", "addr:suburb", "addr:city"].map((k) => text(tags[k])).filter(Boolean).join(", ") || null;
    found.push({
      km: haversineKm(from, { lat, lng }),
      hospital: {
        name,
        address,
        phone: text(tags.phone) || text(tags["contact:phone"]) || null,
        has_emergency: tags.emergency === "yes" ? true : null,
        has_icu: null,
        maps_url: mapsUrl(name, address),
        source_url: raw.type && raw.id !== undefined ? `https://www.openstreetmap.org/${raw.type}/${raw.id}` : null,
      },
    });
  }
  found.sort((a, b) => a.km - b.km);
  const seen = new Set<string>();
  const out: Hospital[] = [];
  for (const { hospital } of found) {
    const key = hospital.name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(hospital);
    if (out.length === KEEP) break;
  }
  return out;
}

async function fromOverpass(lat: number, lng: number): Promise<Hospital[]> {
  try {
    const at = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    const query = `[out:json][timeout:20];(node["amenity"="hospital"](around:${RADIUS_M},${at});way["amenity"="hospital"](around:${RADIUS_M},${at}););out center tags 60;`;
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "User-Agent": USER_AGENT, "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      log({ event: "overpass_not_ok", status: res.status });
      return [];
    }
    return parseOverpass(await res.json(), { lat, lng });
  } catch (err) {
    log({ event: "overpass_failed", error: err instanceof Error ? err.name : "Error" });
    return [];
  }
}

/** The seeded hospitals table, nearest first, within 60 km. */
async function fromTable(lat: number, lng: number): Promise<Hospital[]> {
  const { data, error } = await supabaseAdmin().from("hospitals").select("name, address, phone, lat, lng").not("lat", "is", null).not("lng", "is", null);
  if (error || !data) return [];
  const rows = data as { name: string; address: string | null; phone: string | null; lat: number; lng: number }[];
  return rows
    .map((r) => ({ r, km: haversineKm({ lat, lng }, { lat: r.lat, lng: r.lng }) }))
    .filter((x) => x.km <= FALLBACK_KM)
    .sort((a, b) => a.km - b.km)
    .slice(0, KEEP)
    .map(({ r }) => ({
      name: r.name,
      address: r.address ?? null,
      phone: r.phone ?? null,
      has_emergency: null,
      has_icu: null,
      maps_url: mapsUrl(r.name, r.address ?? null),
      source_url: null,
    }));
}

const MOCK_HOSPITAL: Hospital = {
  name: "[mock] City Emergency Hospital",
  address: "1 Test Road, Delhi",
  phone: "011-2345 6789",
  has_emergency: true,
  has_icu: null,
  maps_url: mapsUrl("[mock] City Emergency Hospital", "1 Test Road, Delhi"),
  source_url: "https://www.openstreetmap.org/node/1",
};

/** Never throws: any failure is an empty list, and an empty answer is not cached. */
export async function findNearbyHospitals(lat: number, lng: number): Promise<EmergencyNearbyRes> {
  try {
    const hit = await cached<{ area: string | null; hospitals: Hospital[] }>(`nearby:v2:${lat.toFixed(2)}:${lng.toFixed(2)}`, "nearby", TTL.day, async () => {
      const area = await reverseGeocode(lat, lng);
      let hospitals: Hospital[];
      if (isWebMock()) hospitals = [MOCK_HOSPITAL];
      else {
        hospitals = await fromOverpass(lat, lng);
        if (hospitals.length === 0) hospitals = await fromTable(lat, lng);
      }
      return hospitals.length > 0 ? { area, hospitals } : null;
    });
    return hit ? { area: hit.value.area, hospitals: hit.value.hospitals, cached: hit.cached } : { area: null, hospitals: [], cached: false };
  } catch (err) {
    log({ event: "nearby_failed", error: err instanceof Error ? err.name : "Error" });
    return { area: null, hospitals: [], cached: false };
  }
}
