// apps/mobile/src/hooks/use-delete-dose-log.ts
// Undo for a dose logged on Today (#488): deleting the row returns the dose to
// "not logged yet", which is the state a first Take or Skip is undone back to.
// The shared DB hooks have no delete for dose logs yet (they are Vaibhav's), so this
// lives in the app layer like `useReminderSync`'s direct client use; the dose_logs
// RLS policy already lets a patient delete their own rows. When a shared
// `useDeleteDoseLog` lands there, this file goes away.

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { DB_KEYS, useSupabase } from "@vyana/shared";

export function useDeleteDoseLog() {
  const sb = useSupabase();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { item_id: string; scheduled_for: string }) => {
      // `.select()` asks for the deleted rows back: under RLS a delete that
      // matches nothing answers with no error and zero rows, so checking
      // `error` alone would report success while the dose kept its new status
      // and the undo was gone (#525 review). Zero rows back is a failure.
      const { data, error } = await sb
        .from("dose_logs")
        .delete()
        .eq("item_id", input.item_id)
        .eq("scheduled_for", input.scheduled_for)
        .select("id");
      if (error) throw new Error(error.message);
      if (!data || data.length === 0) {
        throw new Error("Could not undo that dose. Try again.");
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [DB_KEYS.doseLogs] });
      void queryClient.invalidateQueries({ queryKey: [DB_KEYS.adherence] });
    },
  });
}
