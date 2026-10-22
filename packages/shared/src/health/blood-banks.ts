// packages/shared/src/health/blood-banks.ts
// How the RapidBlood results are ordered on both screens (v1.2, #296): the banks that list the
// most units for the chosen group and component first, then the freshest read. A bank with no
// count listed sorts after every bank with a count. The search itself does not change: this is
// display order only, and the input array is not touched.

import type { BloodBank } from "../contracts";

export function sortBloodBanks(banks: BloodBank[]): BloodBank[] {
  return [...banks].sort((a, b) => {
    const byUnits = (b.units ?? -1) - (a.units ?? -1);
    if (byUnits !== 0) return byUnits;
    return new Date(b.fetched_at).getTime() - new Date(a.fetched_at).getTime();
  });
}
