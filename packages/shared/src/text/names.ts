// packages/shared/src/text/names.ts
// Medicine and test name helpers, kept here so each rule is tested once,
// not re-typed per screen (see also `clean.ts`).

import type { DbPrescriptionItem } from "../db/types";

/** A medicine's display label: its name plus its strength when it has one. */
export function medicineLabel(item: Pick<DbPrescriptionItem, "medicine_name" | "strength">): string {
  return item.strength ? `${item.medicine_name} ${item.strength}` : item.medicine_name;
}

/** A test name reduced to lower-case letters and digits, so "HbA1c" and "Hb A1c" compare equal. */
export function normaliseTestName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}
