// apps/mobile/src/lib/notifications.ts
// Local reminders (doses, refills, follow-up tests) and the push token. What to remind of and when is
// decided by the pure planners in @vyana/shared (health/reminders.ts); this file only schedules them.
// Owner: Vaibhav Parmar

import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import {
  CarePlan,
  listActiveItems,
  listCarePlans,
  listItemDoseLogs,
  listLastLabDates,
  planDoseReminders,
  planFollowUpReminders,
  planRefillAlerts,
  savePushToken,
  sortPlanned,
  type PlannedNotification,
  type ReminderKind,
  type Sb,
} from "@vyana/shared";

/** Android notification channels (the user can mute each one in the system settings). */
export const NOTIFICATION_CHANNELS: Record<ReminderKind, string> = {
  dose: "doses",
  refill: "refills",
  follow_up: "follow-ups",
};

/** The identifiers we schedule start with these, so we never touch another notification. */
const OWN_PREFIXES = ["dose:", "refill:", "followup:"];

export type SyncResult = { permission: boolean; doses: number; refills: number; followUps: number };

export type SyncOptions = {
  /** The time to plan from (tests); defaults to now. */
  now?: Date;
  /**
   * Put medicine and test names in the notification text. Off by default: the text can be read on a
   * locked screen, and a medicine name reveals health data. The app can offer this as a setting.
   */
  showNames?: boolean;
};

/** Shows notifications while the app is open, and creates the Android channels. Call once at start. */
export async function setupNotifications(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.dose, {
      name: "Medicine reminders",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    });
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.refill, {
      name: "Refill alerts",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNELS.follow_up, {
      name: "Check-up test reminders",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

/** Asks for permission to show notifications (once; a refusal is remembered by the system). */
export async function ensureNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  const asked = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } });
  return asked.granted;
}

/**
 * Saves this phone's Expo push token for the signed-in user, so the server can reach it (missed dose
 * alerts for caregivers). Returns the token, or null on a simulator, on the web, without permission, or
 * without an EAS project id (run `eas init` once and the id appears in app.json).
 */
export async function registerPushToken(sb: Sb): Promise<string | null> {
  if (Platform.OS === "web" || !Device.isDevice) return null;
  if (!(await ensureNotificationPermission())) return null;

  const projectId = (Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId) as string | undefined;
  if (!projectId) {
    console.warn("No EAS project id: push tokens need `eas init` (local reminders still work).");
    return null;
  }
  try {
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    await savePushToken(sb, data, Platform.OS === "ios" ? "ios" : "android");
    return data;
  } catch (error) {
    // Expo Go on Android has no push support (SDK 53+); a development build does.
    console.warn("Could not get a push token:", error);
    return null;
  }
}

/** Cancels our scheduled reminders and schedules `planned` in their place. */
async function replaceScheduled(planned: PlannedNotification[]): Promise<void> {
  const existing = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    existing.filter((r) => OWN_PREFIXES.some((p) => r.identifier.startsWith(p))).map((r) => Notifications.cancelScheduledNotificationAsync(r.identifier))
  );
  for (const n of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: n.data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: NOTIFICATION_CHANNELS[n.kind] },
    });
  }
}

/**
 * Rebuilds every reminder from the signed-in patient's data: dose reminders for the next days, a refill
 * alert for each medicine that is running out, and a reminder for each follow-up test of an approved
 * care plan. Safe to call as often as you like (it replaces what it scheduled before). Does nothing
 * without notification permission.
 */
export async function syncReminders(sb: Sb, options: SyncOptions = {}): Promise<SyncResult> {
  const now = options.now ?? new Date();
  const text = { showNames: options.showNames ?? false };
  if (!(await ensureNotificationPermission())) return { permission: false, doses: 0, refills: 0, followUps: 0 };

  const items = await listActiveItems(sb);
  const [logs, plans, lastDone] = await Promise.all([listItemDoseLogs(sb, items.map((i) => i.id)), listCarePlans(sb), listLastLabDates(sb)]);

  const doses = planDoseReminders(items, logs, now, text);
  const refills = planRefillAlerts(items, logs, now, text);
  const followUps = plans
    .filter((p) => p.status === "approved")
    .flatMap((p) => {
      const parsed = CarePlan.safeParse(p.plan_json);
      if (!parsed.success) return [];
      return planFollowUpReminders(p.id, parsed.data.follow_up_tests, lastDone, (p.reviewed_at ?? p.created_at).slice(0, 10), now, text);
    });

  await replaceScheduled(sortPlanned(doses, refills, followUps));
  return { permission: true, doses: doses.length, refills: refills.length, followUps: followUps.length };
}

/** Removes every reminder (call when the user signs out). */
export async function cancelAllReminders(): Promise<void> {
  await replaceScheduled([]);
}

/**
 * For checking the feature by hand ("Done when": time set 1 minute ahead): a medicine reminder and a
 * refill alert that fire `minutes` from now. The next `syncReminders` removes them.
 */
export async function scheduleDemoReminders(minutes = 1): Promise<void> {
  if (!(await ensureNotificationPermission())) return;
  const at = new Date(Date.now() + minutes * 60 * 1000);
  const demo: PlannedNotification[] = [
    { id: "dose:demo", kind: "dose", at, title: "Time for your medicine", body: "Your 09:00 dose is due. Tap to log it.", data: { kind: "dose", demo: "1" } },
    {
      id: "refill:demo",
      kind: "refill",
      at: new Date(at.getTime() + 5000),
      title: "Time to reorder",
      body: "A medicine is running low. Tap to see which and order it again.",
      data: { kind: "refill", demo: "1" },
    },
  ];
  for (const n of demo) {
    await Notifications.scheduleNotificationAsync({
      identifier: n.id,
      content: { title: n.title, body: n.body, data: n.data },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: n.at, channelId: NOTIFICATION_CHANNELS[n.kind] },
    });
  }
}

/**
 * Calls `handler` with the notification's `data` (for example `{ kind: "refill", item_id }`) when the
 * user taps a notification, so a screen can open the right place. Returns the function that stops it.
 */
export function onNotificationTap(handler: (data: Record<string, string>) => void): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    handler((response.notification.request.content.data ?? {}) as Record<string, string>);
  });
  return () => subscription.remove();
}
