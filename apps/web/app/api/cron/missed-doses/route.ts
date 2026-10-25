import { requireCronSecret } from "@/lib/server/data/cron-auth";
import { runLateDoseCheck } from "@/lib/server/data/late-doses";
import { runMissedDoseCheck } from "@/lib/server/data/missed-doses";
import { withRoute } from "@/lib/server/errors";
import { log } from "@/lib/server/log";
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
  // The two checks are isolated: one failing must not skip or mask the other. A failed
  // check reports zeroes here and is logged; the next 15-minute pass retries it.
  let missed = { checked: 0, alerts_sent: 0 };
  try {
    missed = await runMissedDoseCheck(sb, sendPush);
  } catch (error) {
    log({ event: "cron_missed_dose_check_failed", error: error instanceof Error ? error.name : "unknown" });
  }
  let late = { checked: 0, patient_sent: 0, caregiver_sent: 0 };
  try {
    late = await runLateDoseCheck(sb, sendPush);
  } catch (error) {
    log({ event: "cron_late_dose_check_failed", error: error instanceof Error ? error.name : "unknown" });
  }
  return Response.json({
    checked: missed.checked,
    alerts_sent: missed.alerts_sent,
    late_checked: late.checked,
    late_patient_sent: late.patient_sent,
    late_caregiver_sent: late.caregiver_sent,
  });
});
