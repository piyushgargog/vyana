import { AlertsCheckReq, AlertsCheckRes } from "@vyana/shared";
import { checkAlerts } from "@/lib/server/alerts";
import { requireUser } from "@/lib/server/auth";
import { parseBody, withRoute } from "@/lib/server/errors";

// One Search per medicine (max 10), in parallel (SPEC §9).
export const maxDuration = 60;

export const POST = withRoute("alerts/check", async (req, ctx) => {
  const authed = await requireUser(req);
  ctx.userId = authed.user.id;
  await parseBody(req, AlertsCheckReq);
  const res = await checkAlerts(authed, ctx);
  return Response.json(process.env.NODE_ENV === "production" ? res : AlertsCheckRes.parse(res));
});
