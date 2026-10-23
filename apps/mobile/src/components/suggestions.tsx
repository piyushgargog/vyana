import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  useDecideAgentProposal,
  useDecideProposal,
  useMyAgentProposals,
  useMyProposals,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import { MobileSkeletonCard } from '@/components/ui-primitives';
import { Button, Card, CardHeader, Symbol, Text } from '@/components/ui';
import { T } from '@/constants/theme';
import {
  EMPTY_SUGGESTIONS_TEXT,
  decideArgs,
  toSuggestionView,
  visibleSuggestions,
  type SuggestionView,
} from './suggestions-data';

// "Suggestions for you" (#304, #417): care-agent proposals the patient confirms or dismisses,
// at the top of Today. The cards read the real proposals through the db hooks (useMyProposals /
// useDecideProposal); the mock store still serves tests and EXPO_PUBLIC_USE_MOCKS mode. The
// wording comes from the proposal itself (rules wrote it), never from this component. The
// deciding function has no undo, so a dismissal is final — there is no Undo button.
const MAX_COLLAPSED = 3;
const DISCLAIMER = 'Vyana suggested this from your own records.';

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
  proposal: SuggestionView;
  busy: boolean;
  onDecide: (p: SuggestionView, decision: 'approve' | 'reject') => void;
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

function SuggestionsView({
  proposals,
  isLoading,
  isError,
  refetch,
  busyId,
  onDecide,
}: {
  proposals: SuggestionView[];
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  busyId: string | null;
  onDecide: (p: SuggestionView, decision: 'approve' | 'reject') => void;
}) {
  const [showAll, setShowAll] = useState(false);
  // A ticking clock, so a card whose expiry passes while the tab sits open leaves the
  // list without waiting for a refetch.
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tick);
  }, []);

  const visible = visibleSuggestions(proposals, now);
  const shown = showAll ? visible : visible.slice(0, MAX_COLLAPSED);

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
      ) : visible.length === 0 ? (
        <Card>
          <Text variant="subhead" tone="secondary">
            {EMPTY_SUGGESTIONS_TEXT}
          </Text>
        </Card>
      ) : (
        <>
          {shown.map((p) => (
            <ProposalCard
              key={p.id}
              proposal={p}
              busy={busyId === p.id}
              onDecide={onDecide}
            />
          ))}
          {!showAll && visible.length > MAX_COLLAPSED && (
            <Button
              title={`See all ${visible.length} suggestions`}
              variant="secondary"
              label="See all suggestions"
              onPress={() => setShowAll(true)}
            />
          )}
        </>
      )}
    </View>
  );
}

/** Real proposals from the database (#417): pending only, decided through the database function. */
function RealSuggestions() {
  const { showToast } = useVyanaMobile();
  const { data, isLoading, isError, refetch } = useMyProposals('pending');
  const decide = useDecideProposal();

  const handleDecide = (p: SuggestionView, decision: 'approve' | 'reject') => {
    decide.mutate(decideArgs(p.id, decision), {
      onSuccess: () => {
        if (decision === 'approve') showToast('Done', 'success');
      },
      onError: (err) => showToast(err.message, 'error'),
    });
  };

  return (
    <SuggestionsView
      proposals={(data ?? []).map(toSuggestionView)}
      isLoading={isLoading}
      isError={isError}
      refetch={() => void refetch()}
      busyId={decide.isPending ? (decide.variables?.id ?? null) : null}
      onDecide={handleDecide}
    />
  );
}

/** The mock store's proposals, kept for tests and EXPO_PUBLIC_USE_MOCKS mode. */
function MockSuggestions() {
  const { showToast } = useVyanaMobile();
  const { data, isLoading, isError, refetch } = useMyAgentProposals();
  const decide = useDecideAgentProposal();

  const handleDecide = (p: SuggestionView, decision: 'approve' | 'reject') => {
    decide.mutate(
      { id: p.id, decision },
      {
        onSuccess: (res) => {
          if (decision === 'approve') {
            showToast(res.result_text ?? 'Done', 'success');
          }
        },
        onError: (err) => showToast(err.message, 'error'),
      }
    );
  };

  return (
    <SuggestionsView
      proposals={data?.proposals ?? []}
      isLoading={isLoading}
      isError={isError}
      refetch={() => void refetch()}
      busyId={decide.isPending ? (decide.variables?.id ?? null) : null}
      onDecide={handleDecide}
    />
  );
}

export function SuggestionsForYou() {
  const { useMocks } = useVyanaMobile();
  return useMocks ? <MockSuggestions /> : <RealSuggestions />;
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
});
