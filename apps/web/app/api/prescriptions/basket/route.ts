import { BasketCompareReq, BasketCompareRes } from "@vyana/shared";
import { requireUser } from "@/lib/server/auth";
import { parseBody, withRoute } from "@/lib/server/errors";
import { itemsFromPrescription, normalizeItems, startBasketJob } from "@/lib/server/tinyfish/basket";

// Only starts the agents; the slow part runs at TinyFish and is read by GET /{job_id} (SPEC §12).
export const maxDuration = 30;

export const POST = withRoute("prescriptions/basket", async (req, ctx) => {
  const { user, sb } = await requireUser(req);
  ctx.userId = user.id;
  const body = await parseBody(req, BasketCompareReq);
  const items = body.prescription_id ? await itemsFromPrescription(sb, body.prescription_id) : normalizeItems(body.items ?? []);
  const res = await startBasketJob(user.id, items, ctx);
  ctx.cache = res.cached ? "hit" : "miss";
  return Response.json(process.env.NODE_ENV === "production" ? res : BasketCompareRes.parse(res));
});
