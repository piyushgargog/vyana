import { GenerateCarePlanReq, GenerateCarePlanRes, rateLimitOf } from "@vyana/shared";
import { requireRole, requireUser } from "@/lib/server/auth";
import { generateCarePlan } from "@/lib/server/care-plan";
import { checkDailyAiLimit } from "@/lib/server/entitlements";
import { parseBody, withRoute } from "@/lib/server/errors";

// MedlinePlus topic search and our own fetch of 3 pages, then one model call (SPEC §13, ADR-072).
export const maxDuration = 120;

export const POST = withRoute("care-plan", async (req, ctx) => {
  const authed = await requireUser(req);
  ctx.userId = authed.user.id;
  await checkDailyAiLimit(authed.sb);
  requireRole(authed.profile, "patient", "doctor");
  const body = await parseBody(req, GenerateCarePlanReq);
  const res = await generateCarePlan(authed, body);
  return Response.json(process.env.NODE_ENV === "production" ? res : GenerateCarePlanRes.parse(res));
}, { rateLimit: rateLimitOf("ai_other") });
