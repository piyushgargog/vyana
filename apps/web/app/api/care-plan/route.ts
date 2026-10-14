import { GenerateCarePlanReq, GenerateCarePlanRes, rateLimitOf } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { generateCarePlan } from "@/lib/server/care-plan";
import { parseBody, withRoute } from "@/lib/server/errors";

// Search + Fetch of 3 pages, then one model call (SPEC §13).
export const maxDuration = 120;

export const POST = withRoute("care-plan", async (req, ctx) => {
  const authed = await requireUser(req);
  ctx.userId = authed.user.id;
  const body = await parseBody(req, GenerateCarePlanReq);
  const res = await generateCarePlan(authed, body, ctx);
  return Response.json(process.env.NODE_ENV === "production" ? res : GenerateCarePlanRes.parse(res));
}, { rateLimit: rateLimitOf("ai_other") });
