import { describe, expect, it } from "vitest";

import {
  closeDoseUndo,
  doseUndoPlan,
  DOSE_UNDO_WINDOW_MS,
  liveDoseUndo,
  offerDoseUndo,
  type DoseUndoSlots,
} from "./dose-undo";

const KEY = "item-1-09:00";
const T0 = 1_700_000_000_000;

describe("dose undo bookkeeping (#488)", () => {
  it("the undo window is 10 seconds", () => {
    expect(DOSE_UNDO_WINDOW_MS).toBe(10_000);
  });

  it("undoing a just-logged 'pending' dose chooses the delete path", () => {
    // Before the action there was no log row at all, so undo removes the row
    // the Take or Skip wrote instead of logging a status.
    expect(doseUndoPlan("pending")).toEqual({ kind: "delete" });
  });

  it("undo restores the previous status by re-logging it", () => {
    expect(doseUndoPlan("taken")).toEqual({ kind: "relog", status: "taken" });
    expect(doseUndoPlan("skipped")).toEqual({ kind: "relog", status: "skipped" });
  });

  it("undo restores a 'missed' dose by re-logging it: the shared dose log accepts 'missed'", () => {
    // `DoseStatus` in @vyana/shared is "taken" | "missed" | "skipped" and the
    // dose_logs status check admits all three, so a Change from missed can be
    // undone like any other status — it is not excluded from the bookkeeping.
    expect(doseUndoPlan("missed")).toEqual({ kind: "relog", status: "missed" });
  });

  it("an offered undo lives for the window and an expired slot offers no undo", () => {
    const slots = offerDoseUndo({}, KEY, "pending", T0);
    expect(liveDoseUndo(slots, KEY, T0)).toEqual({
      prevStatus: "pending",
      expiresAt: T0 + DOSE_UNDO_WINDOW_MS,
    });
    expect(liveDoseUndo(slots, KEY, T0 + DOSE_UNDO_WINDOW_MS - 1)).not.toBeNull();
    expect(liveDoseUndo(slots, KEY, T0 + DOSE_UNDO_WINDOW_MS)).toBeNull();
    expect(liveDoseUndo(slots, KEY, T0 + DOSE_UNDO_WINDOW_MS + 60_000)).toBeNull();
  });

  it("keeps one slot per dose, and closing one leaves the others alone", () => {
    let slots: DoseUndoSlots = offerDoseUndo({}, "a", "taken", T0);
    slots = offerDoseUndo(slots, "b", "skipped", T0);
    expect(Object.keys(slots).sort()).toEqual(["a", "b"]);

    const closed = closeDoseUndo(slots, "a");
    expect(liveDoseUndo(closed, "a", T0)).toBeNull();
    expect(liveDoseUndo(closed, "b", T0)).not.toBeNull();
    expect(liveDoseUndo(closed, "never-offered", T0)).toBeNull();
    // The bookkeeping is immutable: the input record is untouched.
    expect(liveDoseUndo(slots, "a", T0)).not.toBeNull();
  });
});
