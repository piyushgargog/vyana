import { parseCarePlanJson, type DbCarePlan } from '@vyana/shared';

/**
 * The Today screen's care plan rows (issue #489). The row used to name the newest
 * plan's condition in its subtitle but open the *first condition* — two different
 * "firsts", so a tap could land on another condition's plan. A row is now built from
 * one stored plan: the subtitle names that plan's own condition and the link opens
 * that plan's condition, never a neighbour's.
 */
export interface CarePlanRow {
  /** The condition the row opens — also the list key. */
  conditionId: string;
  href: string;
  /** The plan's own condition text, which the row's subtitle names. */
  condition: string;
}

/**
 * One row per condition that has a plan. `plans` arrives newest first (the query's
 * order), so when a condition was re-planned the newest plan wins and older copies of
 * the same condition stay out. A plan whose JSON does not parse is still listed —
 * labelled plainly "Care plan" — and still opens its own condition.
 */
export function buildCarePlanRows(plans: DbCarePlan[]): CarePlanRow[] {
  const seen = new Set<string>();
  const rows: CarePlanRow[] = [];
  for (const plan of plans) {
    if (seen.has(plan.condition_id)) continue;
    seen.add(plan.condition_id);
    const parsed = parseCarePlanJson(plan.plan_json);
    rows.push({
      conditionId: plan.condition_id,
      href: `/care/${plan.condition_id}`,
      condition: parsed?.condition ?? 'Care plan',
    });
  }
  return rows;
}
