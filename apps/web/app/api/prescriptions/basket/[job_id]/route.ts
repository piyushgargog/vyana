import { BasketCompareRes } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { withRoute } from "@/lib/server/errors";
import { pollBasketJob } from "@/lib/server/tinyfish/basket";

// Room for the run status checks plus one price-verification Fetch per finished pharmacy.
export const maxDuration = 60;

export const GET = withRoute<RouteContext<"/api/prescriptions/basket/[job_id]">>(
  "prescriptions/basket/[job_id]",
  async (req, ctx, { params }) => {
    const { user } = await requireUser(req);
    ctx.userId = user.id;
    const { job_id } = await params;
    const res = await pollBasketJob(user.id, job_id, ctx);
    ctx.cache = res.cached ? "hit" : "miss";
    return Response.json(process.env.NODE_ENV === "production" ? res : BasketCompareRes.parse(res));
  },
);
