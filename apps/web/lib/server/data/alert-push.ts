import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "../log";
import type { PushMessage, PushResult } from "../push";

/** The Android channel for medicine quality alerts; the app creates it at start (`apps/mobile/src/lib/notifications.ts`). */
export const QUALITY_ALERT_CHANNEL = "quality-alerts";

export interface AlertedPatient {
  patient_id: string;
  /** How many new alerts were saved for this patient in this run. */
  count: number;
}

const CHUNK = 100;

type Send = (messages: PushMessage[]) => Promise<PushResult>;

/**
 * Tells each patient who got new medicine quality alerts, with ONE push per patient however many alerts there are.
 * The text names no medicine, no batch and no manufacturer, because a locked screen shows it; the app opens the
 * alerts list when it is tapped. It never throws: the alerts are already saved, and a push that cannot be sent must
 * not fail the webhook that found them. Dead tokens are deleted. Returns how many phones were told.
 */
export async function pushQualityAlerts(sb: SupabaseClient, send: Send, alerted: AlertedPatient[]): Promise<number> {
  if (alerted.length === 0) return 0;
  try {
    const countOf = new Map(alerted.map((a) => [a.patient_id, a.count]));
    const ids = [...countOf.keys()];
    const tokens: { user_id: string; token: string }[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data, error } = await sb.from("push_tokens").select("user_id, token").in("user_id", ids.slice(i, i + CHUNK));
      if (error) throw error;
      tokens.push(...((data ?? []) as { user_id: string; token: string }[]));
    }
    if (tokens.length === 0) return 0;

    const messages: PushMessage[] = tokens.map(({ user_id, token }) => ({
      to: token,
      title: "Medicine quality alert",
      body:
        (countOf.get(user_id) ?? 1) > 1
          ? "Medicines you use are named in government quality alerts. Tap to see them."
          : "A medicine you use is named in a government quality alert. Tap to see it.",
      data: { kind: "quality_alert" },
      channelId: QUALITY_ALERT_CHANNEL,
    }));

    const result = await send(messages);
    if (result.invalidTokens.length > 0) await sb.from("push_tokens").delete().in("token", result.invalidTokens);
    log({ event: "quality_alert_push", patients: ids.length, sent: result.sent, failed: result.failed });
    return result.sent;
  } catch {
    log({ event: "quality_alert_push_failed" });
    return 0;
  }
}
