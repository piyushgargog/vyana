import { AdminDoctorCheckReq, DoctorVerifyReq, DoctorVerifyRes, rateLimitOf } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { adminCheckDoctor, submitDoctorRegistration } from "@/lib/server/doctor-verify";
import { badRequest, forbidden, withRoute } from "@/lib/server/errors";

// A doctor sends their registration details; an admin records a check done by hand (issue #344).
export const maxDuration = 30;

export const POST = withRoute("doctors/verify", async (req, ctx) => {
  const authed = await requireUser(req);
  ctx.userId = authed.user.id;
  // The caller's role is settled before the body is read (issue #359): any other role is refused
  // outright, so a patient or caregiver gets 403 whatever they send, well-formed or not. Only then
  // is the body parsed, with the schema that fits the role.
  const role = authed.profile.role;
  if (role !== "admin" && role !== "doctor") {
    throw forbidden();
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badRequest("Request body must be valid JSON");
  }
  let res;
  if (role === "admin") {
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
