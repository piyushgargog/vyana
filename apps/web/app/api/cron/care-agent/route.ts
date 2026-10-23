import { runCareAgentLoop } from "@/lib/server/agent/loop";
import { requireCronSecret } from "@/lib/server/data/cron-auth";
import { withRoute } from "@/lib/server/errors";
import { supabaseAdmin } from "@/lib/server/supabase-admin";

// Called by the scheduler Piyush runs on the server (see RUNBOOK.md), not by a user.
export const maxDuration = 60;

/** Runs the care agent rules over every patient, writes their proposals and closes the expired ones. */
export const POST = withRoute("cron/care-agent", async (req) => {
  requireCronSecret(req);
  const result = await runCareAgentLoop(supabaseAdmin());
  return Response.json(result);
});
