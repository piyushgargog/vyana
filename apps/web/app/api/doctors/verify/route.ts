import { z } from "zod";
import { AdminDoctorCheckReq, DoctorVerifyReq, DoctorVerifyRes, rateLimitOf } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { adminCheckDoctor, submitDoctorRegistration } from "@/lib/server/doctor-verify";
import { badRequest, forbidden, jsonRes, parseBody, withRoute } from "@/lib/server/errors";

/**
 * DoctorVerifyReq plus the admin-only `decision` key, only so the route can refuse a doctor sending an admin's
 * check (issue #359): a plain DoctorVerifyReq parse would strip the key before the route could see it.
 */
const DoctorVerifyReqDetectDecision = DoctorVerifyReq.extend({ decision: z.unknown().optional() });

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
  // The body is read through parseBody (issue #666), so the size cap it enforces applies to this route
  // too once it lands (PR #542), instead of this route reading an unbounded body with req.json().
  let res;
  if (role === "admin") {
    res = await adminCheckDoctor(authed, await parseBody(req, AdminDoctorCheckReq));
  } else {
    const body = await parseBody(req, DoctorVerifyReqDetectDecision);
    // A `decision` belongs to an admin's check; a doctor only sends their own registration details.
    if ("decision" in body) {
      throw badRequest("Only an admin can record a check. Send your registration number and state council.");
    }
    res = await submitDoctorRegistration(authed, DoctorVerifyReq.parse(body));
  }
  return jsonRes(DoctorVerifyRes, res);
}, { rateLimit: rateLimitOf("lookup") });
