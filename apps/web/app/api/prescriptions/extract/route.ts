import { PrescriptionExtractReq, PrescriptionExtractRes, rateLimitOf } from "@vyana/shared";
import { requireRole, requireUser } from "@/lib/server/auth";
import { enforceDailyAiLimit } from "@/lib/server/entitlements";
import { jsonRes, parseBody, withRoute } from "@/lib/server/errors";
import { extractPrescription } from "@/lib/server/prescriptions";

// A transcription and an extraction call on a photo.
export const maxDuration = 120;

export const POST = withRoute("prescriptions/extract", async (req, ctx) => {
  const { user, profile, sb } = await requireUser(req);
  ctx.userId = user.id;
  requireRole(profile, "patient");
  await enforceDailyAiLimit({ profile, sb });
  const body = await parseBody(req, PrescriptionExtractReq);
  const allergies = Array.isArray(profile.allergies) ? profile.allergies.filter((a): a is string => typeof a === "string") : [];
  const res = await extractPrescription({ id: user.id, fullName: profile.full_name, allergies }, sb, body.file_path);
  return jsonRes(PrescriptionExtractRes, res);
}, { rateLimit: rateLimitOf("ai_document") });
