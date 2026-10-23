import { BloodSearchReq, BloodSearchRes, rateLimitOf } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { jsonRes, parseBody, withRoute } from "@/lib/server/errors";
import { startBloodJob } from "@/lib/server/blood";

// Reads the public stock service now (about a second); GET /{job_id} repeats the search from the cache (RapidBlood, ADR-072).
export const maxDuration = 30;

export const POST = withRoute("blood/search", async (req, ctx) => {
  const { user } = await requireUser(req);
  ctx.userId = user.id;
  const body = await parseBody(req, BloodSearchReq);
  const res = await startBloodJob(user.id, body);
  ctx.cache = res.cached ? "hit" : "miss";
  return jsonRes(BloodSearchRes, res);
}, { rateLimit: rateLimitOf("lookup") });
