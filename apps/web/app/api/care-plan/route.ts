import { GenerateCarePlanReq, GenerateCarePlanRes, rateLimitOf } from "@vyana/shared";
import { requireRole, requireUser } from "@/lib/server/auth";
import { generateCarePlan } from "@/lib/server/care-plan";
import { enforceDailyAiLimit } from "@/lib/server/entitlements";
import { jsonRes, parseBody, withRoute } from "@/lib/server/errors";

// MedlinePlus topic search and our own fetch of 3 pages, then one model call (SPEC §13, ADR-072).
export const maxDuration = 120;

export const POST = withRoute("care-plan", async (req, ctx) => {
  const authed = await requireUser(req);
  ctx.userId = authed.user.id;
  requireRole(authed.profile, "patient", "doctor");
  await enforceDailyAiLimit(authed);
  const body = await parseBody(req, GenerateCarePlanReq);
  const res = await generateCarePlan(authed, body);
  return jsonRes(GenerateCarePlanRes, res);
}, { rateLimit: rateLimitOf("ai_other") });
