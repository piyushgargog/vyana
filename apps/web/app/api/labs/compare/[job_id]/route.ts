import { LabsCompareRes } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { withRoute } from "@/lib/server/errors";
import { pollLabJob } from "@/lib/server/tinyfish/labs";

// Room for the run status checks plus one price-verification Fetch per finished lab.
export const maxDuration = 60;

export const GET = withRoute<RouteContext<"/api/labs/compare/[job_id]">>("labs/compare/[job_id]", async (req, ctx, { params }) => {
  const { user } = await requireUser(req);
  ctx.userId = user.id;
  const { job_id } = await params;
  const res = await pollLabJob(user.id, job_id, ctx);
  ctx.cache = res.cached ? "hit" : "miss";
  return Response.json(process.env.NODE_ENV === "production" ? res : LabsCompareRes.parse(res));
});
