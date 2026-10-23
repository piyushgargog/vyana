// #417: the suggestion cards read the real proposals. These tests pin the shaping the
// cards rely on — the stored title and reason pass through untouched, a decision maps
// to the decide hook's approve flag, expired cards leave the list, and the empty state
// keeps the issue's exact wording.
import { describe, expect, it } from 'vitest';
import type { DbAgentProposal } from '@vyana/shared';
import {
  EMPTY_SUGGESTIONS_TEXT,
  decideArgs,
  evidenceRows,
  toSuggestionView,
  visibleSuggestions,
} from './suggestions-data';

function row(partial: Partial<DbAgentProposal> = {}): DbAgentProposal {
  return {
    id: 'proposal-1',
    patient_id: 'patient-1',
    kind: 'refill_due',
    title: 'Your metformin pack: 30 tablets',
    reason: 'Your prescription lists metformin in packs of 30 tablets.',
    payload: {},
    evidence: [{ label: 'Pack size from your prescription', detail: '30 tablets' }],
    status: 'pending',
    rule_id: null,
    dedupe_key: null,
    created_at: '2026-10-22T10:00:00.000Z',
    expires_at: null,
    decided_at: null,
    ...partial,
  };
}

describe('suggestion card data (#417)', () => {
  it('shows the stored title and reason exactly as stored', () => {
    const view = toSuggestionView(row());
    expect(view.title).toBe('Your metformin pack: 30 tablets');
    expect(view.reason).toBe('Your prescription lists metformin in packs of 30 tablets.');
    expect(view.evidence).toEqual([
      { label: 'Pack size from your prescription', detail: '30 tablets' },
    ]);
  });

  it('keeps only evidence rows the card can render', () => {
    expect(
      evidenceRows([
        { label: 'Last HbA1c report', detail: 'Uploaded 3 months ago' },
        { label: 'Missing detail' },
        { detail: 'Missing label' },
        { label: 42, detail: 'Not a string' },
        null,
        'not a row',
      ])
    ).toEqual([{ label: 'Last HbA1c report', detail: 'Uploaded 3 months ago' }]);
    expect(evidenceRows('not an array')).toEqual([]);
    expect(evidenceRows(null)).toEqual([]);
  });

  it('approve and reject map to the decide hook\'s approve flag', () => {
    expect(decideArgs('proposal-1', 'approve')).toEqual({ id: 'proposal-1', approve: true });
    expect(decideArgs('proposal-1', 'reject')).toEqual({ id: 'proposal-1', approve: false });
  });

  it('expired cards leave the list; unexpired and no-expiry cards stay', () => {
    const now = new Date('2026-10-23T10:00:00.000Z').getTime();
    const views = ['a', 'b', 'c'].map((id, i) =>
      toSuggestionView(
        row({
          id,
          expires_at:
            i === 0 ? '2026-10-22T10:00:00.000Z' : i === 1 ? '2026-10-24T10:00:00.000Z' : null,
        })
      )
    );
    expect(visibleSuggestions(views, now).map((v) => v.id)).toEqual(['b', 'c']);
  });

  it('an empty list is the empty state, with the issue\'s exact wording', () => {
    expect(visibleSuggestions([], Date.now())).toEqual([]);
    expect(EMPTY_SUGGESTIONS_TEXT).toBe('Nothing to suggest right now.');
  });
});
