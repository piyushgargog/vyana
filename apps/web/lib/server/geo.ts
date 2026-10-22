import "server-only";
import { z } from "zod";
import { log } from "./log";
import { isWebMock } from "./web/domains";

/**
 * Reverse geocoding with OpenStreetMap Nominatim (SPEC §5). Its usage policy asks for an identifying
 * User-Agent and light use; results are cached by the nearby route for 6 h per ~1 km area.
 * Returns a short area name ("Preet Vihar, Delhi") or null. Never throws.
 */

const NOMINATIM = "https://nominatim.openstreetmap.org/reverse";
const TIMEOUT_MS = 5000;

const Reverse = z.object({
  address: z
    .object({
      suburb: z.string().optional(),
      neighbourhood: z.string().optional(),
      quarter: z.string().optional(),
      city_district: z.string().optional(),
      city: z.string().optional(),
      town: z.string().optional(),
      village: z.string().optional(),
      state_district: z.string().optional(),
    })
    .optional(),
});

export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  // Mock mode makes no outbound web calls at all.
  if (isWebMock()) return "[mock] Preet Vihar, Delhi";
  try {
    const url = `${NOMINATIM}?format=jsonv2&zoom=14&addressdetails=1&lat=${lat}&lon=${lng}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "vyana-health/1.0", "Accept-Language": "en" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const parsed = Reverse.safeParse(await res.json());
    const a = parsed.success ? parsed.data.address : undefined;
    if (!a) return null;
    const local = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district;
    const city = a.city ?? a.town ?? a.village ?? a.state_district;
    const area = [local, city].filter(Boolean).join(", ");
    return area || null;
  } catch {
    log({ event: "reverse_geocode_failed" });
    return null;
  }
}
