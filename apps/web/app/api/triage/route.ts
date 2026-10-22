import { TriageReq, TriageRes, rateLimitOf } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { checkDailyAiLimit } from "@/lib/server/entitlements";
import { parseBody, withRoute } from "@/lib/server/errors";
import { triage } from "@/lib/server/triage";

// One model call at most (SPEC §15). No role gate on purpose: any signed-in user may check symptoms —
// the answer is worked out from the caller's own profile only, so there is no role to gate on.
export const maxDuration = 60;

export const POST = withRoute("triage", async (req, ctx) => {
  const authed = await requireUser(req);
  ctx.userId = authed.user.id;
  await checkDailyAiLimit(authed.sb);
  const body = await parseBody(req, TriageReq);
  const res = await triage(authed, body);
  return Response.json(process.env.NODE_ENV === "production" ? res : TriageRes.parse(res));
}, { rateLimit: rateLimitOf("ai_other") });
