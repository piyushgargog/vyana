import "server-only";
import { upstream } from "./errors";

/** Expo's push service: one POST with up to 100 messages. */
export const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;
const TIMEOUT_MS = 10_000;

export interface PushMessage {
  /** An Expo push token: `ExponentPushToken[...]`. */
  to: string;
  title: string;
  body: string;
  /** Strings only. What the app needs to open the right screen when the notification is tapped. */
  data?: Record<string, string>;
  /** Android notification channel; it must exist on the phone (the app creates its channels at start). */
  channelId?: string;
}

export interface PushResult {
  /** Messages the push service accepted. */
  sent: number;
  /** Messages it refused for another reason than a dead token. */
  failed: number;
  /** Tokens that no longer work (app uninstalled, token expired) or are not Expo tokens: delete them. */
  invalidTokens: string[];
}

export function isExpoPushToken(token: string): boolean {
  return (token.startsWith("ExponentPushToken[") || token.startsWith("ExpoPushToken[")) && token.endsWith("]");
}

interface Ticket {
  status: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

/**
 * Sends push notifications through Expo, 100 at a time. A network error or a non-2xx answer from Expo
 * throws (502), so the caller can try again later. A refusal of a single message does not throw: it is
 * counted, and a dead token (`DeviceNotRegistered`) is returned in `invalidTokens`.
 *
 * Never put health details in `title` or `body`: they show on a locked screen. If Expo's "enhanced push
 * security" is on, set `EXPO_ACCESS_TOKEN`.
 */
export async function sendPush(messages: PushMessage[], options: { fetch?: typeof fetch } = {}): Promise<PushResult> {
  const doFetch = options.fetch ?? fetch;
  const result: PushResult = { sent: 0, failed: 0, invalidTokens: [] };

  const valid: PushMessage[] = [];
  for (const m of messages) {
    if (isExpoPushToken(m.to)) valid.push(m);
    else result.invalidTokens.push(m.to);
  }

  for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
    const chunk = valid.slice(i, i + CHUNK_SIZE);
    const headers: Record<string, string> = { accept: "application/json", "content-type": "application/json" };
    if (process.env.EXPO_ACCESS_TOKEN) headers.authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;

    let res: Response;
    try {
      res = await doFetch(EXPO_PUSH_URL, {
        method: "POST",
        headers,
        body: JSON.stringify(chunk.map((m) => ({ ...m, sound: "default", priority: "high" }))),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw upstream("The push service did not answer.");
    }
    if (!res.ok) throw upstream("The push service refused the request.");

    const json = (await res.json().catch(() => null)) as { data?: Ticket[] } | null;
    const tickets = json?.data;
    if (!Array.isArray(tickets) || tickets.length !== chunk.length) throw upstream("The push service sent an unexpected answer.");

    tickets.forEach((ticket, index) => {
      if (ticket.status === "ok") result.sent++;
      else if (ticket.details?.error === "DeviceNotRegistered") result.invalidTokens.push(chunk[index].to);
      else result.failed++;
    });
  }
  return result;
}
