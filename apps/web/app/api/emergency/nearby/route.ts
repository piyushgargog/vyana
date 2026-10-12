import { EmergencyNearbyReq, EmergencyNearbyRes } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { parseBody, withRoute } from "@/lib/server/errors";
import { log } from "@/lib/server/log";
import { findNearbyHospitals } from "@/lib/server/tinyfish/hospitals";

// Search + Fetch + one model call; well under a minute.
export const maxDuration = 60;

export const POST = withRoute("emergency/nearby", async (req, ctx) => {
  const { user } = await requireUser(req);
  ctx.userId = user.id;
  const body = await parseBody(req, EmergencyNearbyReq);
  let res: EmergencyNearbyRes;
  try {
    res = await findNearbyHospitals(body.lat, body.lng, { userId: user.id, counter: ctx });
  } catch (err) {
    // Never 5xx here: the SOS screen must keep working and still shows 108 (SPEC §5).
    log({ event: "nearby_failed", error: err instanceof Error ? err.name : "Error" });
    res = { area: null, hospitals: [], cached: false };
  }
  ctx.cache = res.cached ? "hit" : "miss";
  return Response.json(process.env.NODE_ENV === "production" ? res : EmergencyNearbyRes.parse(res));
});
