import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { EmergencySosReq, EmergencySosRes, Hospital } from "@vyana/shared";
import { log } from "./log";
import { supabaseAdmin } from "./supabase-admin";
import type { CallCounter } from "./tinyfish/client";
import { findNearbyHospitals } from "./tinyfish/hospitals";

/**
 * SOS (SPEC §6). The ambulance status is SIMULATED until a real ambulance integration exists; the UI labels it.
 * Patients can't write emergency_requests themselves (RLS), so the server writes them with the admin client.
 */

const NEARBY_BUDGET_MS = 8000;
export const DISPATCHED_AFTER_MS = 20_000;
export const ARRIVING_AFTER_MS = 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Nearby hospitals within the SOS time budget; an empty list on timeout or error (SOS must never fail). */
async function nearbyWithin(lat: number, lng: number, ctx: { userId: string; counter: CallCounter }): Promise<{ area: string | null; hospitals: Hospital[] }> {
  const timeout = sleep(NEARBY_BUDGET_MS).then(() => ({ area: null, hospitals: [] as Hospital[] }));
  const lookup = findNearbyHospitals(lat, lng, ctx).catch(() => ({ area: null, hospitals: [] as Hospital[] }));
  return Promise.race([lookup, timeout]);
}

export function smsBody(fullName: string | null, lat: number, lng: number): string {
  return `EMERGENCY: ${fullName?.trim() || "A Vyana user"} needs help. Location: https://maps.google.com/?q=${lat},${lng}. Sent from Vyana.`;
}

export async function startSos(
  user: { id: string; fullName: string | null },
  sb: SupabaseClient,
  body: EmergencySosReq,
  counter: CallCounter,
): Promise<EmergencySosRes> {
  const eta = 8 + Math.floor(Math.random() * 8); // 8–15 min, simulated
  const { data: row, error } = await supabaseAdmin()
    .from("emergency_requests")
    .insert({ patient_id: user.id, lat: body.lat, lng: body.lng, note: body.note ?? null, status: "requested", eta_minutes: eta })
    .select("id")
    .single();
  if (error || !row) throw error ?? new Error("emergency request not created");
  const requestId = (row as { id: string }).id;

  const [nearby, contacts] = await Promise.all([
    nearbyWithin(body.lat, body.lng, { userId: user.id, counter }),
    sb
      .from("emergency_contacts")
      .select("name, phone")
      .eq("patient_id", user.id)
      .then(({ data }) => ((data ?? []) as { name: string; phone: string }[]).map((c) => ({ name: c.name, phone: c.phone }))),
  ]);

  const { error: updateError } = await supabaseAdmin()
    .from("emergency_requests")
    .update({ area: nearby.area, hospitals_json: nearby.hospitals })
    .eq("id", requestId);
  if (updateError) log({ event: "sos_update_failed" });

  return {
    request_id: requestId,
    status: "requested",
    eta_minutes: eta,
    hospitals: nearby.hospitals,
    contacts,
    sms_body: smsBody(user.fullName, body.lat, body.lng),
  };
}

/**
 * Runs after the response (via `after()`): moves the request to "dispatched" and then "arriving", unless the
 * patient cancelled it meanwhile. Simulated.
 */
export async function simulateAmbulance(requestId: string, wait: (ms: number) => Promise<unknown> = sleep): Promise<void> {
  const admin = supabaseAdmin();
  await wait(DISPATCHED_AFTER_MS);
  await admin.from("emergency_requests").update({ status: "dispatched" }).eq("id", requestId).eq("status", "requested");
  await wait(ARRIVING_AFTER_MS - DISPATCHED_AFTER_MS);
  await admin.from("emergency_requests").update({ status: "arriving" }).eq("id", requestId).eq("status", "dispatched");
}
