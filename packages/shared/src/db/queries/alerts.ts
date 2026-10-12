// packages/shared/src/db/queries/alerts.ts
// Medicine quality alerts that the server found on the web. Owner: Vaibhav Parmar

import type { DbDrugAlert } from "../types";
import { requireUserId, unwrap, type Sb } from "./helpers";

/** The signed-in patient's drug alerts: unseen first, then newest first. */
export async function listDrugAlerts(sb: Sb): Promise<DbDrugAlert[]> {
  const patientId = await requireUserId(sb);
  return unwrap(
    await sb.from("drug_alerts").select("*").eq("patient_id", patientId).order("seen", { ascending: true }).order("created_at", { ascending: false })
  );
}

export async function markAlertSeen(sb: Sb, id: string): Promise<DbDrugAlert> {
  return unwrap(await sb.from("drug_alerts").update({ seen: true }).eq("id", id).select().single());
}
