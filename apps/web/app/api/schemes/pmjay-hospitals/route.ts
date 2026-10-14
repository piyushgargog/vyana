import { PmjayHospitalsReq, PmjayHospitalsRes, rateLimitOf } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { parseBody, withRoute } from "@/lib/server/errors";
import { findPmjayHospitals } from "@/lib/server/tinyfish/hospitals";

// Search + Fetch of up to 3 government pages, then one model call (SPEC §17).
export const maxDuration = 90;

export const POST = withRoute("schemes/pmjay-hospitals", async (req, ctx) => {
  const { user } = await requireUser(req);
  ctx.userId = user.id;
  const body = await parseBody(req, PmjayHospitalsReq);
  const res = await findPmjayHospitals(body.lat, body.lng, { userId: user.id, counter: ctx });
  return Response.json(process.env.NODE_ENV === "production" ? res : PmjayHospitalsRes.parse(res));
}, { rateLimit: rateLimitOf("agent") });
