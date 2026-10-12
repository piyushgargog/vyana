import { requireCronSecret } from "@/lib/server/data/cron-auth";
import { runMissedDoseCheck } from "@/lib/server/data/missed-doses";
import { withRoute } from "@/lib/server/errors";
import { sendPush } from "@/lib/server/push";
import { supabaseAdmin } from "@/lib/server/supabase-admin";

// Called every 15 minutes by pg_cron (supabase/migrations/0008_missed_dose_cron.sql), not by a user.
export const maxDuration = 60;

/** Finds doses that were due 60+ minutes ago and never logged, for patients with a caregiver, and pushes each once. */
export const POST = withRoute("cron/missed-doses", async (req) => {
  requireCronSecret(req);
  const result = await runMissedDoseCheck(supabaseAdmin(), sendPush);
  return Response.json(result);
});
