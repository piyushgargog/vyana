import { requireCronSecret } from "@/lib/server/data/cron-auth";
import { runLateDoseCheck } from "@/lib/server/data/late-doses";
import { runMissedDoseCheck } from "@/lib/server/data/missed-doses";
import { withRoute } from "@/lib/server/errors";
import { sendPush } from "@/lib/server/push";
import { supabaseAdmin } from "@/lib/server/supabase-admin";

// Called every 15 minutes by pg_cron (supabase/migrations/0008_missed_dose_cron.sql), not by a user.
export const maxDuration = 60;

/**
 * Finds doses that were due 60+ minutes ago and never logged, for patients with a caregiver, and pushes each
 * once. The same pass runs the late-dose nudge (issue #495): the patient at 30 minutes, the caregivers at 90.
 */
export const POST = withRoute("cron/missed-doses", async (req) => {
  requireCronSecret(req);
  const sb = supabaseAdmin();
  const missed = await runMissedDoseCheck(sb, sendPush);
  const late = await runLateDoseCheck(sb, sendPush);
  return Response.json({
    checked: missed.checked,
    alerts_sent: missed.alerts_sent,
    late_checked: late.checked,
    late_patient_sent: late.patient_sent,
    late_caregiver_sent: late.caregiver_sent,
  });
});
