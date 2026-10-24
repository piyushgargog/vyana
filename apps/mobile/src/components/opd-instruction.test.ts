import { describe, expect, it } from 'vitest';

import { opdInstruction } from './opd-instruction';

const TODAY = '2026-10-23';

describe('opdInstruction', () => {
  it('gives the reporting time only for a confirmed token dated today or later', () => {
    expect(opdInstruction({ status: 'confirmed', appointment_date: TODAY, token_no: 12 }, TODAY)).toBe(
      'Report to the OPD registration desk by 8:30 AM with Token #12.',
    );
    expect(
      opdInstruction({ status: 'confirmed', appointment_date: '2026-10-30', token_no: 3 }, TODAY),
    ).toContain('8:30 AM');
  });

  it('never promises the reporting time for an unconfirmed token', () => {
    const text = opdInstruction({ status: 'requested', appointment_date: '2026-10-30', token_no: 3 }, TODAY);
    expect(text).toBe('Requested — the hospital has not confirmed this token yet.');
    expect(text).not.toContain('8:30');
  });

  it('states a past confirmed visit as past, not as a reporting instruction', () => {
    const text = opdInstruction({ status: 'confirmed', appointment_date: '2026-10-01', token_no: 3 }, TODAY);
    expect(text).not.toContain('8:30');
    expect(text).toContain('has passed');
  });

  it('names completed and cancelled tokens in words', () => {
    expect(opdInstruction({ status: 'completed', appointment_date: '2026-10-01', token_no: 3 }, TODAY)).toBe(
      'This visit is complete.',
    );
    expect(opdInstruction({ status: 'cancelled', appointment_date: '2026-10-30', token_no: 3 }, TODAY)).toBe(
      'This token was cancelled.',
    );
  });
});
