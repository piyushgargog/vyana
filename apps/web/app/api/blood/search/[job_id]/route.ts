import { BloodSearchRes } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { jsonRes, withRoute } from "@/lib/server/errors";
import { pollBloodJob } from "@/lib/server/blood";

export const maxDuration = 60;

export const GET = withRoute<RouteContext<"/api/blood/search/[job_id]">>("blood/search/[job_id]", async (req, ctx, { params }) => {
  const { user } = await requireUser(req);
  ctx.userId = user.id;
  const { job_id } = await params;
  const res = await pollBloodJob(user.id, job_id);
  ctx.cache = res.cached ? "hit" : "miss";
  return jsonRes(BloodSearchRes, res);
});
