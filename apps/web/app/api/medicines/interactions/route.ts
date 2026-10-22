import { InteractionsReq, InteractionsRes, rateLimitOf } from "@vyana/shared";
import { requireRole, requireUser } from "@/lib/server/auth";
import { parseBody, withRoute } from "@/lib/server/errors";
import { checkInteractions } from "@/lib/server/interactions";

// Pure table lookup over the reviewed list of well-known interactions; no model call.
export const maxDuration = 120;

export const POST = withRoute("medicines/interactions", async (req, ctx) => {
  const authed = await requireUser(req);
  ctx.userId = authed.user.id;
  requireRole(authed.profile, "patient", "doctor");
  const body = await parseBody(req, InteractionsReq);
  const res = await checkInteractions(authed, body);
  return Response.json(process.env.NODE_ENV === "production" ? res : InteractionsRes.parse(res));
}, { rateLimit: rateLimitOf("ai_other") });
