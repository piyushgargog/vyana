// packages/shared/src/db/queries/realtime.ts
// Live updates through Supabase Realtime. Realtime applies the RLS policies, so a user only
// receives rows they can select. Owner: Vaibhav Parmar

import { REALTIME } from "../../constants";
import type { Sb } from "./helpers";

/** The tables that publish live changes (supabase/migrations/0004_realtime.sql). */
export type LiveTable = "care_plans" | "appointments" | "drug_alerts" | "emergency_requests";

/** The Realtime channel name of a live table for one user (plan 7.1 `REALTIME`; care plans have no entry there). */
export function liveChannelName(table: LiveTable, userId: string): string {
  switch (table) {
    case "appointments":
      return REALTIME.appointmentsForDoctor(userId);
    case "drug_alerts":
      return REALTIME.alertsForPatient(userId);
    case "care_plans":
      return `care-plans:${userId}`;
    case "emergency_requests":
      return `emergency-requests:${userId}`;
  }
}

/**
 * Calls `onChange` after any insert, update or delete on `table`. Pass a `filter` such as
 * `patient_id=eq.<uuid>` to narrow it. Returns the function that stops listening.
 */
export function subscribeTable(sb: Sb, channelName: string, table: LiveTable, onChange: () => void, filter?: string): () => void {
  const channel = sb
    .channel(channelName)
    .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, () => onChange())
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}
