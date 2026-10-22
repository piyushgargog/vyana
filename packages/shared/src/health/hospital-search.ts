// packages/shared/src/health/hospital-search.ts
// The hospital picker's search (#286): a pure filter over the hospitals already loaded,
// by name or city. Kept in shared so the rule is tested once, not re-typed per screen.

export interface HospitalSearchEntry {
  name: string;
  city: string;
}

/**
 * The hospitals whose name or city contains the query (case-insensitive, the query's
 * surrounding spaces ignored). An empty or whitespace-only query returns them all.
 * Never mutates the input.
 */
export function filterHospitalsByQuery<T extends HospitalSearchEntry>(
  hospitals: readonly T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...hospitals];
  return hospitals.filter(
    (h) => h.name.toLowerCase().includes(q) || h.city.toLowerCase().includes(q)
  );
}
