// apps/mobile/src/lib/useReminderSync.ts
// Keeps the phone's reminders in step with the patient's data. Call it once in the root layout, inside
// <AppProviders>. Owner: Vaibhav Parmar

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { AppState } from "react-native";

import { DB_KEYS, QUERY_ROOTS, useSession, useSupabase } from "@vyana/shared";

import { cancelAllReminders, registerPushToken, setupNotifications, syncReminders } from "./notifications";

/** Query roots whose change can change a reminder: medicines, dose logs, care plans and lab results. */
const WATCHED_ROOTS = new Set<string>([
  QUERY_ROOTS.prescriptions,
  QUERY_ROOTS.activeItems,
  QUERY_ROOTS.carePlans,
  QUERY_ROOTS.labReports,
  QUERY_ROOTS.labValues,
  DB_KEYS.doseLogs,
  DB_KEYS.adherence,
]);

/**
 * When the user is signed in: sets up notifications, saves the push token, schedules the reminders, and
 * schedules them again (after a short pause) when the data above changes or the app comes back to the
 * front. When the user signs out, the reminders are removed.
 */
export function useReminderSync(): void {
  const sb = useSupabase();
  const { user, loading } = useSession();
  const queryClient = useQueryClient();
  const userId = user?.id ?? null;

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      void cancelAllReminders().catch(() => undefined);
      return;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = () => {
      void setupNotifications()
        .then(() => syncReminders(sb))
        .catch((error) => console.warn("Could not schedule the reminders:", error));
    };
    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(run, 1500);
    };

    void setupNotifications().then(() => registerPushToken(sb)).catch(() => undefined);
    schedule();

    const stopCache = queryClient.getQueryCache().subscribe((event) => {
      if (event.type === "updated" && event.action.type === "success" && WATCHED_ROOTS.has(String(event.query.queryKey[0]))) schedule();
    });
    const stopAppState = AppState.addEventListener("change", (state) => {
      if (state === "active") schedule();
    });

    return () => {
      if (timer) clearTimeout(timer);
      stopCache();
      stopAppState.remove();
    };
  }, [sb, userId, loading, queryClient]);
}
