import { ReportAnalyzeReq, ReportAnalyzeRes, rateLimitOf } from "@vyana/shared";
import { requireRole, requireUser } from "@/lib/server/auth";
import { checkDailyAiLimit } from "@/lib/server/entitlements";
import { parseBody, withRoute } from "@/lib/server/errors";
import { analyzeReport } from "@/lib/server/reports";

// A transcription, an extraction and a summary call on a photo.
export const maxDuration = 120;

export const POST = withRoute("reports/analyze", async (req, ctx) => {
  const authed = await requireUser(req);
  ctx.userId = authed.user.id;
  await checkDailyAiLimit(authed.sb);
  requireRole(authed.profile, "patient");
  const body = await parseBody(req, ReportAnalyzeReq);
  const res = await analyzeReport(authed, body.file_path, body.report_date);
  return Response.json(process.env.NODE_ENV === "production" ? res : ReportAnalyzeRes.parse(res));
}, { rateLimit: rateLimitOf("ai_document") });
