// packages/shared/src/db/queries/emergency.ts
// Owner: Vaibhav Parmar

import { REALTIME } from "../../constants";
import type { DbEmergencyRequest } from "../types";
import { unwrap, type Sb } from "./helpers";

export async function getEmergencyRequest(sb: Sb, id: string): Promise<DbEmergencyRequest> {
  return unwrap(await sb.from("emergency_requests").select("*").eq("id", id).single());
}

/** The patient cancels their request (a patient may change nothing else on it). */
export async function cancelEmergency(sb: Sb, id: string): Promise<DbEmergencyRequest> {
  return unwrap(await sb.from("emergency_requests").update({ status: "cancelled" }).eq("id", id).select().single());
}

/**
 * Calls `cb` with the new row whenever the request changes (status, ETA, hospitals). Realtime applies
 * RLS, so only the patient and an active caregiver receive it. Returns the function that stops listening.
 */
export function subscribeEmergency(sb: Sb, id: string, cb: (row: DbEmergencyRequest) => void): () => void {
  const channel = sb
    .channel(REALTIME.emergency(id))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "emergency_requests", filter: `id=eq.${id}` }, (payload) => {
      cb(payload.new as DbEmergencyRequest);
    })
    .subscribe();
  return () => {
    void sb.removeChannel(channel);
  };
}
