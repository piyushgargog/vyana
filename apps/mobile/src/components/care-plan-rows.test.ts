import { describe, expect, it } from 'vitest';
import type { DbCarePlan } from '@vyana/shared';

import { buildCarePlanRows } from './care-plan-rows';

/** A complete stored plan (the shape the CarePlan contract parses), named for one condition. */
const planJson = (condition: string, language: 'en' | 'hi' | 'hinglish' = 'en') => ({
  condition,
  summary: 'A steady plan.',
  do: ['Walk after dinner'],
  dont: ['Skip doses'],
  diet: { eat_more: ['Vegetables'], limit: ['Sugar'], sample_day: [{ meal: 'breakfast', items: ['Oats'] }] },
  red_flags: ['Chest pain'],
  follow_up_tests: [{ test: 'HbA1c', every_days: 90 }],
  sources: [],
  language,
});

const plan = (fields: Partial<DbCarePlan>): DbCarePlan =>
  ({
    id: 'plan-1',
    condition_id: 'cond-diabetes',
    plan_json: planJson('Type 2 Diabetes'),
    ...fields,
  }) as DbCarePlan;

describe('buildCarePlanRows', () => {
  it('opens the plan the row names — the plan’s own condition, not the first condition', () => {
    const rows = buildCarePlanRows([plan({})]);
    expect(rows).toEqual([
      { conditionId: 'cond-diabetes', href: '/care/cond-diabetes', condition: 'Type 2 Diabetes' },
    ]);
  });

  it('gives several plans one row each, in the order the plans arrive', () => {
    const rows = buildCarePlanRows([
      plan({ id: 'plan-2', condition_id: 'cond-thyroid', plan_json: planJson('Hypothyroidism', 'hi') }),
      plan({}),
    ]);
    expect(rows.map((r) => r.href)).toEqual(['/care/cond-thyroid', '/care/cond-diabetes']);
    expect(rows.map((r) => r.condition)).toEqual(['Hypothyroidism', 'Type 2 Diabetes']);
  });

  it('keeps the newest plan when a condition was planned twice', () => {
    const rows = buildCarePlanRows([
      plan({ id: 'plan-new', plan_json: planJson('Type 2 Diabetes', 'hinglish') }),
      plan({ id: 'plan-old', plan_json: planJson('Diabetes (old draft)') }),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].condition).toBe('Type 2 Diabetes');
  });

  it('still lists a plan whose JSON does not parse, opening its own condition', () => {
    const rows = buildCarePlanRows([plan({ plan_json: 'not a plan' })]);
    expect(rows).toEqual([
      { conditionId: 'cond-diabetes', href: '/care/cond-diabetes', condition: 'Care plan' },
    ]);
  });

  it('returns no rows when there are no plans', () => {
    expect(buildCarePlanRows([])).toEqual([]);
  });
});
