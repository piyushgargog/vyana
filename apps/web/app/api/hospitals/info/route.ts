import { HospitalInfoReq, HospitalInfoRes, rateLimitOf } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { parseBody, withRoute } from "@/lib/server/errors";
import { hospitalOpdInfo } from "@/lib/server/tinyfish/hospitals";

export const maxDuration = 60;

export const POST = withRoute("hospitals/info", async (req, ctx) => {
  const { user, sb } = await requireUser(req);
  ctx.userId = user.id;
  const body = await parseBody(req, HospitalInfoReq);
  const res = await hospitalOpdInfo(body.hospital_id, sb, { userId: user.id, counter: ctx });
  ctx.cache = res.cached ? "hit" : "miss";
  return Response.json(process.env.NODE_ENV === "production" ? res : HospitalInfoRes.parse(res));
}, { rateLimit: rateLimitOf("agent") });
