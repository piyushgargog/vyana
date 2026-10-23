// packages/shared/src/health/adherence.ts
// Adherence as Proportion of Days Covered (PDC), issue #495. Pure: no I/O, no clock reads —
// the caller passes the window. Days are India calendar days (IST is a fixed UTC+5:30).
//
// The model, per the issue: each taken dose covers its day; covered days merge (two doses on
// one day still cover one day); days outside the prescription's own range never count, and a
// log outside that range covers nothing. Per medicine the days are the prescription's active
// days inside the window; overall, a day counts when at least one medicine was active, and
// is covered when at least one of that day's medicines was taken — the per-medicine rows are
// where a dropped medicine shows. "Doses a day" does not change a day's coverage under this
// model: one taken dose covers the day.
//
// The 80% cut-off: the Pharmacy Quality Alliance (PQA) selected 0.8 as the threshold above
// which a patient is considered highly adherent for most chronic-medication classes, and its
// PDC measures (used in CMS Star Ratings) use it — D. Nau, "Proportion of Days Covered (PDC)
// as a Preferred Method of Measuring Medication Adherence", Pharmacy Quality Alliance; see
// also Canfield et al., "Navigating the wild west of medication adherence reporting" and the
// review at PMC8715592 ("the threshold for adequate adherence has been placed at 80% for
// most medications, and 90% for antiretrovirals"). Checked 2026-10-23.
// Owner: Vaibhav Parmar

import { addDays, daysBetween, istDayOf } from "./dates";

/** PDC at or above this percentage counts as adherent (PQA; see the header). */
export const ADHERENT_PDC_PERCENT = 80;

/** Below this many observed days a percentage is not shown on screen (issue #495). */
export const MIN_DAYS_FOR_PDC = 7;

/** The prescription fields PDC needs: when the medicine runs. */
export type PdcItem = { id: string; start_date: string; end_date: string | null };

/** The dose-log fields PDC needs. */
export type PdcLog = { item_id: string; scheduled_for: string; status: string };

export type PdcResult = {
  /** Days in the window with at least one taken dose. */
  covered: number;
  /** Days the medicine (or any medicine, overall) was active inside the window. */
  days: number;
  /** covered / days as a whole percentage; 0 when there are no days. */
  pdc: number;
  /** False under MIN_DAYS_FOR_PDC days — a screen must not show the percentage yet. */
  enough_data: boolean;
};

export type PdcReport = {
  overall: PdcResult;
  perMedicine: (PdcResult & { item_id: string })[];
};

function result(covered: number, days: number): PdcResult {
  return {
    covered,
    days,
    pdc: days === 0 ? 0 : Math.round((covered / days) * 100),
    enough_data: days >= MIN_DAYS_FOR_PDC,
  };
}

/** Every date from `from` to `to` inclusive (`YYYY-MM-DD` strings compare in date order). */
function eachDay(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * PDC for the window [`fromDate`, `toDate`] (both `YYYY-MM-DD`, both included), per medicine
 * and overall. Logs with a status other than `taken` never cover a day.
 */
export function computePdc(items: PdcItem[], logs: PdcLog[], fromDate: string, toDate: string): PdcReport {
  const takenDays = new Map<string, Set<string>>();
  for (const log of logs) {
    if (log.status !== "taken") continue;
    const day = istDayOf(log.scheduled_for);
    const set = takenDays.get(log.item_id) ?? new Set<string>();
    set.add(day);
    takenDays.set(log.item_id, set);
  }

  const allActive = new Set<string>();
  const allCovered = new Set<string>();
  const perMedicine = items.map((item) => {
    const from = item.start_date > fromDate ? item.start_date : fromDate;
    const to = item.end_date && item.end_date < toDate ? item.end_date : toDate;
    const active = to < from ? [] : eachDay(from, to);
    const taken = takenDays.get(item.id) ?? new Set<string>();
    const covered = active.filter((d) => taken.has(d));
    for (const d of active) allActive.add(d);
    for (const d of covered) allCovered.add(d);
    return { item_id: item.id, ...result(covered.length, active.length) };
  });

  return { overall: result(allCovered.size, allActive.size), perMedicine };
}

/** True when the result has enough days and meets the PQA 80% threshold. */
export function isAdherent(r: PdcResult): boolean {
  return r.enough_data && r.pdc >= ADHERENT_PDC_PERCENT;
}
