import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useDecideAgentProposal, useMyAgentProposals, type AgentProposal } from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { MobileSkeletonCard } from '@/components/ui-primitives';
import { Button, Card, CardHeader, Symbol, Text } from '@/components/ui';
import { T } from '@/constants/theme';

// "Suggestions for you" (#304): care-agent proposals the patient confirms or dismisses, at the
// top of Today. Mock-first against the provisional contract in @vyana/shared; the wording comes
// from the proposal itself (rules wrote it), never from this component.
const MAX_COLLAPSED = 3;
const DISCLAIMER = 'Vyana suggested this from your own records. It is not medical advice.';

function suggestedOn(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function ProposalCard({
  proposal,
  busy,
  onDecide,
}: {
  proposal: AgentProposal;
  busy: boolean;
  onDecide: (p: AgentProposal, decision: 'approve' | 'reject') => void;
}) {
  const [whyOpen, setWhyOpen] = useState(false);
  return (
    <Card>
      <Text variant="headline">{proposal.title}</Text>
      <Text variant="subhead" tone="secondary">
        {proposal.reason}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Why you see this: ${proposal.title}`}
        accessibilityState={{ expanded: whyOpen }}
        onPress={() => setWhyOpen((v) => !v)}
        style={styles.whyToggle}
      >
        <Text variant="subhead" tone="accent" style={styles.strong}>
          Why you see this
        </Text>
        <Symbol
          ios={whyOpen ? 'chevron.up' : 'chevron.down'}
          android={whyOpen ? 'expand_less' : 'expand_more'}
          size={16}
          color={T.color.accentStrong}
        />
      </Pressable>
      {whyOpen && (
        <View style={styles.evidence}>
          {proposal.evidence.map((row) => (
            <View key={row.label} style={styles.evidenceRow}>
              <Text variant="footnote" style={styles.strong}>
                {row.label}
              </Text>
              <Text variant="footnote" tone="secondary">
                {row.detail}
              </Text>
            </View>
          ))}
          <Text variant="caption" tone="tertiary">
            Suggested on {suggestedOn(proposal.created_at)}
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <Button
          title="Do it"
          label={`Do it: ${proposal.title}`}
          disabled={busy}
          onPress={() => onDecide(proposal, 'approve')}
          style={styles.actionBtn}
        />
        <Button
          title="Not now"
          variant="secondary"
          label={`Not now: ${proposal.title}`}
          disabled={busy}
          onPress={() => onDecide(proposal, 'reject')}
          style={styles.actionBtn}
        />
      </View>
      <Text variant="caption" tone="tertiary">
        {DISCLAIMER}
      </Text>
    </Card>
  );
}

export function SuggestionsForYou() {
  const { showToast } = useVyanaMobile();
  const { data, isLoading, isError, refetch } = useMyAgentProposals();
  const decide = useDecideAgentProposal();
  const [showAll, setShowAll] = useState(false);
  // Every dismissal keeps its own undo slot and timer, so dismissing a second card
  // never makes the first one permanent early.
  const [undos, setUndos] = useState<{ id: string; title: string }[]>([]);
  const undoTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // A ticking clock, so a card whose expiry passes while the tab sits open leaves the
  // list without waiting for a refetch.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timers = undoTimers.current;
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearInterval(tick);
      timers.forEach((t) => clearTimeout(t));
    };
  }, []);

  const proposals = (data?.proposals ?? []).filter(
    (p) => p.expires_at === null || new Date(p.expires_at).getTime() > now
  );
  const visible = showAll ? proposals : proposals.slice(0, MAX_COLLAPSED);

  const dropUndo = (id: string) => {
    const timer = undoTimers.current.get(id);
    if (timer) clearTimeout(timer);
    undoTimers.current.delete(id);
    setUndos((prev) => prev.filter((u) => u.id !== id));
  };

  const handleDecide = (p: AgentProposal, decision: 'approve' | 'reject') => {
    decide.mutate(
      { id: p.id, decision },
      {
        onSuccess: (res) => {
          if (decision === 'approve') {
            showToast(res.result_text ?? 'Done', 'success');
          } else if (res.undo_seconds > 0) {
            setUndos((prev) => [...prev.filter((u) => u.id !== p.id), { id: p.id, title: p.title }]);
            undoTimers.current.set(
              p.id,
              setTimeout(() => dropUndo(p.id), res.undo_seconds * 1000)
            );
          }
        },
        onError: (err) => showToast(err.message, 'error'),
      }
    );
  };

  const handleUndo = (id: string) => {
    dropUndo(id);
    decide.mutate(
      { id, decision: 'restore' },
      { onError: (err) => showToast(err.message, 'error') }
    );
  };

  return (
    <View style={styles.section}>
      <CardHeader title="Suggestions for you" />

      {isLoading ? (
        <MobileSkeletonCard lines={3} />
      ) : isError ? (
        <Card>
          <Text variant="subhead">Suggestions could not be loaded.</Text>
          <Button title="Try again" variant="secondary" label="Try loading suggestions again" onPress={() => refetch()} />
        </Card>
      ) : proposals.length === 0 ? (
        <Card>
          <Text variant="subhead" tone="secondary">
            Nothing to suggest right now.
          </Text>
        </Card>
      ) : (
        <>
          {visible.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              busy={decide.isPending && decide.variables?.id === p.id}
              onDecide={handleDecide}
            />
          ))}
          {!showAll && proposals.length > MAX_COLLAPSED && (
            <Button
              title={`See all ${proposals.length} suggestions`}
              variant="secondary"
              label="See all suggestions"
              onPress={() => setShowAll(true)}
            />
          )}
          {undos.map((u) => (
            <View key={u.id} style={styles.undoBar}>
              <Text variant="footnote" tone="secondary" style={styles.undoText}>
                Dismissed: {u.title}
              </Text>
              <Button title="Undo" variant="secondary" size="md" label="Undo the dismissal" onPress={() => handleUndo(u.id)} />
            </View>
          ))}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: T.space.md },
  strong: { fontWeight: '700' },
  whyToggle: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.xs,
  },
  evidence: {
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    padding: T.space.md,
    gap: T.space.xs,
  },
  evidenceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: T.space.md,
    flexWrap: 'wrap',
  },
  actions: { flexDirection: 'row', gap: T.space.sm },
  actionBtn: { flex: 1, minHeight: 44 },
  undoBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: T.space.sm,
    backgroundColor: T.color.fill,
    borderRadius: T.radius.row,
    borderCurve: 'continuous',
    paddingHorizontal: T.space.md,
    paddingVertical: T.space.sm,
  },
  undoText: { flex: 1 },
});
