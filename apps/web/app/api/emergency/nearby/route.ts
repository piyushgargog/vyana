import { EmergencyNearbyReq, EmergencyNearbyRes, rateLimitOf } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { jsonRes, parseBody, withRoute } from "@/lib/server/errors";
import { log } from "@/lib/server/log";
import { findNearbyHospitals } from "@/lib/server/web/overpass";

// One public map request with a 12 s timeout, then the seeded table.
export const maxDuration = 30;

export const POST = withRoute("emergency/nearby", async (req, ctx) => {
  const { user } = await requireUser(req);
  ctx.userId = user.id;
  const body = await parseBody(req, EmergencyNearbyReq);
  let res: EmergencyNearbyRes;
  try {
    res = await findNearbyHospitals(body.lat, body.lng);
  } catch (err) {
    // Never 5xx here: the SOS screen must keep working and still shows 108 (SPEC §5).
    log({ event: "nearby_failed", error: err instanceof Error ? err.name : "Error" });
    res = { area: null, hospitals: [], cached: false };
  }
  ctx.cache = res.cached ? "hit" : "miss";
  return jsonRes(EmergencyNearbyRes, res);
}, { rateLimit: rateLimitOf("public") });
