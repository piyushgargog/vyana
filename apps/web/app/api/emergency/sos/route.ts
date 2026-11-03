import { after } from "next/server";
import { EmergencySosReq, EmergencySosRes } from "@vyana/shared";
import { requireRole, requireUser } from "@/lib/server/auth";
import { simulateAmbulance, startSos } from "@/lib/server/emergency";
import { jsonRes, parseBody, withRoute } from "@/lib/server/errors";

// The simulated status updates run after the response for 60 s (SPEC §6).
export const maxDuration = 70;

export const POST = withRoute("emergency/sos", async (req, ctx) => {
  const { user, profile, sb } = await requireUser(req);
  ctx.userId = user.id;
  requireRole(profile, "patient");
  const body = await parseBody(req, EmergencySosReq);
  const res = await startSos({ id: user.id, fullName: profile.full_name }, sb, body);
  // Scheduled only once the request exists, and only for a fresh request: a repeat call returns
  // the active request whose simulated status is already running. after() also runs when a handler throws.
  if (!res.existing) after(() => simulateAmbulance(res.request_id));
  // The existing flag is internal only: production responses pass through unparsed, so build the
  // contract body without it.
  return jsonRes(EmergencySosRes, {
    request_id: res.request_id,
    status: res.status,
    eta_minutes: res.eta_minutes,
    hospitals: res.hospitals,
    contacts: res.contacts,
    sms_body: res.sms_body,
  });
});
