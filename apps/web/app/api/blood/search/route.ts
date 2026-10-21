import { BloodSearchReq, BloodSearchRes, rateLimitOf } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { parseBody, withRoute } from "@/lib/server/errors";
import { startBloodJob } from "@/lib/server/tinyfish/blood";

// Only starts the agents; GET /{job_id} reads them (RapidBlood, v1.1.0).
export const maxDuration = 30;

export const POST = withRoute("blood/search", async (req, ctx) => {
  const { user } = await requireUser(req);
  ctx.userId = user.id;
  const body = await parseBody(req, BloodSearchReq);
  const res = await startBloodJob(user.id, body, ctx);
  ctx.cache = res.cached ? "hit" : "miss";
  return Response.json(process.env.NODE_ENV === "production" ? res : BloodSearchRes.parse(res));
}, { rateLimit: rateLimitOf("agent") });
