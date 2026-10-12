import { PrescriptionExtractReq, PrescriptionExtractRes } from "@vyana/shared";
import { requireRole, requireUser } from "@/lib/server/auth";
import { parseBody, withRoute } from "@/lib/server/errors";
import { extractPrescription } from "@/lib/server/prescriptions";

// A transcription and an extraction call on a photo.
export const maxDuration = 120;

export const POST = withRoute("prescriptions/extract", async (req, ctx) => {
  const { user, profile, sb } = await requireUser(req);
  ctx.userId = user.id;
  requireRole(profile, "patient");
  const body = await parseBody(req, PrescriptionExtractReq);
  const allergies = Array.isArray(profile.allergies) ? profile.allergies.filter((a): a is string => typeof a === "string") : [];
  const res = await extractPrescription({ id: user.id, fullName: profile.full_name, allergies }, sb, body.file_path);
  return Response.json(process.env.NODE_ENV === "production" ? res : PrescriptionExtractRes.parse(res));
});
