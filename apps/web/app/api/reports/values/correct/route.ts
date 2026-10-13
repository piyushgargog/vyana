import { LabValueCorrectReq, LabValueCorrectRes } from "@vyana/shared";
import { requireRole, requireUser } from "@/lib/server/auth";
import { parseBody, withRoute } from "@/lib/server/errors";
import { correctLabValue } from "@/lib/server/reports";

// A patient corrects one value of their own report; the flag is recomputed on the server (SPEC §4b, ADR-062).
export const POST = withRoute("reports/values/correct", async (req, ctx) => {
  const authed = await requireUser(req);
  ctx.userId = authed.user.id;
  requireRole(authed.profile, "patient");
  const body = await parseBody(req, LabValueCorrectReq);
  const res = await correctLabValue(authed, body);
  return Response.json(process.env.NODE_ENV === "production" ? res : LabValueCorrectRes.parse(res));
});
