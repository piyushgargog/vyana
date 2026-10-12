import { timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import { z } from "zod";
import { processMonitorResults } from "@/lib/server/alerts";
import { unauthorized, withRoute } from "@/lib/server/errors";
import { log } from "@/lib/server/log";

// The work runs after the response (SPEC §10): Fetch of up to 10 pages.
export const maxDuration = 60;

const Payload = z
  .object({
    search_monitor_id: z.string().optional(),
    results: z.array(z.object({ url: z.string(), title: z.string().optional(), snippet: z.string().optional(), position: z.number().int().optional() }).loose()).default([]),
    new_result_positions: z.array(z.number().int()).optional(),
  })
  .loose();

function secretOk(given: string | null): boolean {
  const expected = process.env.MONITOR_WEBHOOK_SECRET ?? "";
  if (!given || !expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const POST = withRoute("webhooks/tinyfish-monitor", async (req, ctx) => {
  if (!secretOk(new URL(req.url).searchParams.get("secret"))) throw unauthorized("Invalid webhook secret");
  const parsed = Payload.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    log({ event: "monitor_payload_invalid" });
    return Response.json({ ok: true });
  }
  const { results, new_result_positions } = parsed.data;
  // Only the new results: positions match each result's own 1-based `position` (its place in the list if missing).
  const fresh = new_result_positions?.length
    ? results.filter((res, i) => new_result_positions.includes(res.position ?? i + 1))
    : results;
  after(() => processMonitorResults(fresh, ctx).catch(() => log({ event: "monitor_processing_failed" })));
  return Response.json({ ok: true });
});
