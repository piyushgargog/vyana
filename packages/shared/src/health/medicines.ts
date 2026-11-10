// packages/shared/src/health/medicines.ts
// Medicine display helpers shared by the reminder planners, the medical ID builder and the
// interaction check, so the same medicine is labelled the same way everywhere.

/** "Metformin 500 mg", or just the name when no strength is recorded. */
export function medicineLabel(item: { medicine_name: string; strength?: string | null }): string {
  return item.strength ? `${item.medicine_name} ${item.strength}` : item.medicine_name;
}
