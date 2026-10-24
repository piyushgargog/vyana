// apps/mobile/src/lib/dose-undo.ts
// The dose Undo bookkeeping for Today (#488), as pure functions so the rules can
// be tested without rendering the screen: after a Take or Skip, the status the
// dose had before the action is kept for a 10-second window; undoing inside the
// window restores that status, and once the window closes the offer is gone.

import type { DoseStatus } from "@vyana/shared";

/** The status of one scheduled dose slot, as the Today row shows it; `pending` is "not logged yet". */
export type DoseSlotStatus = DoseStatus | "pending";

/** How long a Take or Skip stays undoable on Today, in milliseconds (#488). */
export const DOSE_UNDO_WINDOW_MS = 10_000;

/** One dose's open undo offer: what it was before the action, and when the offer ends. */
export interface DoseUndoSlot {
  prevStatus: DoseSlotStatus;
  /** ms epoch at which the offer ends; at or after this moment there is no undo. */
  expiresAt: number;
}

/** Every open undo offer on Today, keyed by dose slot, so doses never undo each other. */
export type DoseUndoSlots = Record<string, DoseUndoSlot>;

/** Offer undo for a dose just acted on, remembering the status it had before. */
export function offerDoseUndo(
  slots: DoseUndoSlots,
  key: string,
  prevStatus: DoseSlotStatus,
  nowMs: number,
  windowMs: number = DOSE_UNDO_WINDOW_MS,
): DoseUndoSlots {
  return { ...slots, [key]: { prevStatus, expiresAt: nowMs + windowMs } };
}

/** The dose's undo offer if it is still inside its window, otherwise null. */
export function liveDoseUndo(
  slots: DoseUndoSlots,
  key: string,
  nowMs: number,
): DoseUndoSlot | null {
  const slot = slots[key];
  if (!slot) return null;
  return nowMs < slot.expiresAt ? slot : null;
}

/** Close a dose's undo offer (the window ended, or the undo went through). */
export function closeDoseUndo(slots: DoseUndoSlots, key: string): DoseUndoSlots {
  if (!(key in slots)) return slots;
  const next = { ...slots };
  delete next[key];
  return next;
}

/**
 * What an undo must do to put the dose back, decided from the status it had
 * before the action:
 * - `pending`: no log row existed before the action, so undo deletes the row
 *   the action wrote;
 * - `taken`, `skipped` or `missed`: a row with that status existed, so undo
 *   logs that status again. All three are statuses the shared dose log accepts
 *   end to end (`DoseStatus` in @vyana/shared, and the dose_logs status check
 *   in the schema), `missed` included.
 */
export type DoseUndoPlan = { kind: "delete" } | { kind: "relog"; status: DoseStatus };

export function doseUndoPlan(prevStatus: DoseSlotStatus): DoseUndoPlan {
  if (prevStatus === "pending") return { kind: "delete" };
  return { kind: "relog", status: prevStatus };
}
