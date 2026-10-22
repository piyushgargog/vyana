import { DoctorVerifyReq, DoctorVerifyRes, rateLimitOf } from "@vyana/shared";
import { requireRole, requireUser } from "@/lib/server/auth";
import { verifyDoctor } from "@/lib/server/doctor-verify";
import { parseBody, withRoute } from "@/lib/server/errors";

// One register agent run (90 s) when the answer isn't cached (SPEC §7).
export const maxDuration = 120;

export const POST = withRoute("doctors/verify", async (req, ctx) => {
  const authed = await requireUser(req);
  ctx.userId = authed.user.id;
  requireRole(authed.profile, "doctor");
  const body = await parseBody(req, DoctorVerifyReq);
  const res = await verifyDoctor(authed, body, ctx);
  return Response.json(process.env.NODE_ENV === "production" ? res : DoctorVerifyRes.parse(res));
}, { rateLimit: rateLimitOf("agent") });
