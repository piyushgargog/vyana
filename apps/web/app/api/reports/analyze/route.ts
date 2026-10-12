import { Language, ReportAnalyzeReq, ReportAnalyzeRes } from "@vyana/shared";
import { requireRole, requireUser } from "@/lib/server/auth";
import { parseBody, withRoute } from "@/lib/server/errors";
import { analyzeReport } from "@/lib/server/reports";

// A transcription, an extraction and a summary call on a photo.
export const maxDuration = 120;

export const POST = withRoute("reports/analyze", async (req, ctx) => {
  const { user, profile } = await requireUser(req);
  ctx.userId = user.id;
  requireRole(profile, "patient");
  const body = await parseBody(req, ReportAnalyzeReq);
  const language = Language.safeParse(profile.preferred_language).data ?? "en";
  const res = await analyzeReport({ id: user.id, fullName: profile.full_name, language }, body.file_path, body.report_date);
  return Response.json(process.env.NODE_ENV === "production" ? res : ReportAnalyzeRes.parse(res));
});
