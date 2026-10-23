// Data shaping for the suggestion cards (#417): the cards read the real care-agent
// proposals through the db hooks, and this module keeps the shaping pure and testable.
// The stored title and reason pass through untouched; only the evidence rows the card
// can render are kept.
import type { AgentProposal, DbAgentProposal } from '@vyana/shared';

/** The fields a suggestion card renders; a contract proposal and a stored proposal row both fit it. */
export type SuggestionView = Pick<
  AgentProposal,
  'id' | 'title' | 'reason' | 'evidence' | 'created_at' | 'expires_at'
>;

/** Shown when nothing is pending; the wording is the issue's, do not paraphrase it. */
export const EMPTY_SUGGESTIONS_TEXT = 'Nothing to suggest right now.';

/** Evidence rows the card can render: { label, detail } string pairs; anything else is dropped. */
export function evidenceRows(evidence: unknown): { label: string; detail: string }[] {
  if (!Array.isArray(evidence)) return [];
  const rows: { label: string; detail: string }[] = [];
  for (const row of evidence) {
    if (typeof row !== 'object' || row === null) continue;
    const { label, detail } = row as { label?: unknown; detail?: unknown };
    if (
      typeof label === 'string' &&
      label.length > 0 &&
      typeof detail === 'string' &&
      detail.length > 0
    ) {
      rows.push({ label, detail });
    }
  }
  return rows;
}

/** A stored proposal row as a card view: title and reason exactly as stored. */
export function toSuggestionView(p: DbAgentProposal): SuggestionView {
  return {
    id: p.id,
    title: p.title,
    reason: p.reason,
    evidence: evidenceRows(p.evidence),
    created_at: p.created_at,
    expires_at: p.expires_at,
  };
}

/** A card whose expiry has passed leaves the list even while the tab sits open. */
export function visibleSuggestions<T extends { expires_at: string | null }>(
  list: readonly T[],
  now: number
): T[] {
  return list.filter((p) => p.expires_at === null || new Date(p.expires_at).getTime() > now);
}

/** The real decide hook takes an approve flag; the cards speak in decisions. */
export function decideArgs(
  id: string,
  decision: 'approve' | 'reject'
): { id: string; approve: boolean } {
  return { id, approve: decision === 'approve' };
}
