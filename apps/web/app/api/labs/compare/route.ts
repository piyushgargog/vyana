import { LabsCompareReq, LabsCompareRes, rateLimitOf } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { parseBody, withRoute } from "@/lib/server/errors";
import { startLabJob } from "@/lib/server/tinyfish/labs";

// Only finds each lab's page and starts the agents; GET /{job_id} reads them (SPEC §2, ADR-050).
export const maxDuration = 30;

export const POST = withRoute("labs/compare", async (req, ctx) => {
  const { user } = await requireUser(req);
  ctx.userId = user.id;
  const body = await parseBody(req, LabsCompareReq);
  const res = await startLabJob(user.id, body.test_name, body.city, ctx);
  ctx.cache = res.cached ? "hit" : "miss";
  return Response.json(process.env.NODE_ENV === "production" ? res : LabsCompareRes.parse(res));
}, { rateLimit: rateLimitOf("agent") });
