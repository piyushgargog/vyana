import { AdminDoctorCheckReq, DoctorVerifyReq, DoctorVerifyRes, rateLimitOf } from "@vyana/shared";
import { requireRole, requireUser } from "@/lib/server/auth";
import { adminCheckDoctor, submitDoctorRegistration } from "@/lib/server/doctor-verify";
import { badRequest, withRoute } from "@/lib/server/errors";

// A doctor sends their registration details; an admin records a check done by hand (issue #344).
export const maxDuration = 30;

export const POST = withRoute("doctors/verify", async (req, ctx) => {
  const authed = await requireUser(req);
  ctx.userId = authed.user.id;
  requireRole(authed.profile, "doctor", "admin");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  let res;
  if (authed.profile.role === "admin") {
    res = await adminCheckDoctor(authed, AdminDoctorCheckReq.parse(raw));
  } else {
    // A `decision` belongs to an admin's check; a doctor only sends their own registration details.
    if (raw !== null && typeof raw === "object" && "decision" in raw) {
      throw badRequest("Only an admin can record a check. Send your registration number and state council.");
    }
    res = await submitDoctorRegistration(authed, DoctorVerifyReq.parse(raw));
  }
  return Response.json(process.env.NODE_ENV === "production" ? res : DoctorVerifyRes.parse(res));
}, { rateLimit: rateLimitOf("lookup") });
