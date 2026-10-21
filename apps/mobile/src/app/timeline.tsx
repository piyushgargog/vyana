import React, { memo, useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import {
  isShareUrlDead,
  shareScopeLabel,
  useCreateShareLink,
  useShareLinks,
  useTimeline,
  type ShareScope,
  type TimelineEntry,
  type TimelineKind,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Pill,
  Screen,
  Symbol,
  Text,
} from '@/components/ui';
import { MobileDisclaimerFooter, MobileQrGrid } from '@/components/ui-primitives';
import { T } from '@/constants/theme';

const FILTERS = ['all', 'prescription', 'report', 'appointment', 'condition'] as const;

/** How long a share link can last (#239). */
const DURATIONS = [
  { hours: 24, label: '24 hours' },
  { hours: 168, label: '7 days' },
  { hours: 720, label: '30 days' },
] as const;

/** The record sections a scoped link can include — the Health Memory Graph scopes (#237). */
const SCOPE_OPTIONS: { scope: ShareScope; label: string }[] = [
  { scope: 'labs', label: 'Labs' },
  { scope: 'vitals', label: 'Vitals' },
  { scope: 'medicines', label: 'Medicines' },
  { scope: 'adherence', label: 'Adherence' },
];

function filterLabel(f: (typeof FILTERS)[number]): string {
  switch (f) {
    case 'all':
      return 'All events';
    case 'prescription':
      return 'Prescriptions';
    case 'report':
      return 'Lab reports';
    case 'appointment':
      return 'OPD visits';
    case 'condition':
      return 'Care plans';
  }
}

function kindPill(kind: TimelineKind): { label: string; tone: 'accent' | 'neutral' | 'warn' } {
  switch (kind) {
    case 'prescription':
      return { label: 'Prescription', tone: 'accent' };
    case 'report':
      return { label: 'Lab report', tone: 'neutral' };
    case 'appointment':
      return { label: 'OPD visit', tone: 'warn' };
    case 'condition':
      return { label: 'Care plan', tone: 'neutral' };
  }
}

const TimelineItem = memo(function TimelineItem({
  item,
  onPress,
}: {
  item: TimelineEntry;
  onPress: (entry: TimelineEntry) => void;
}) {
  const pill = kindPill(item.kind);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title} on ${item.date}`}
      onPress={() => onPress(item)}
    >
      <Card>
        <View style={styles.cardHeader}>
          <Pill text={pill.label} tone={pill.tone} />
          <Text variant="footnote" tone="tertiary">
            {item.date}
          </Text>
        </View>
        <Text variant="headline">{item.title}</Text>
        {item.subtitle ? (
          <Text variant="subhead" tone="secondary">
            {item.subtitle}
          </Text>
        ) : null}
        <View style={styles.detailsRow}>
          <Text variant="footnote" tone="accent" style={styles.detailsText}>
            View details
          </Text>
          <Symbol ios="chevron.right" android="chevron_right" size={14} color={T.color.accentStrong} />
        </View>
      </Card>
    </Pressable>
  );
});

export default function TimelineScreen() {
  const router = useRouter();
  const { baseUrl, showToast } = useVyanaMobile();

  const { data: timeline = [], isLoading, isError: timelineError, refetch: refetchTimeline } = useTimeline();
  const createShareMutation = useCreateShareLink();

  const [filter, setFilter] = useState<'all' | TimelineKind>('all');
  const [shareOpen, setShareOpen] = useState(false);
  const [durationHours, setDurationHours] = useState<number>(24);
  // Opt-in (#239 review): a fresh link shares the basic timeline only; the patient
  // switches on each record section they want the doctor to see.
  const [selectedScopes, setSelectedScopes] = useState<ShareScope[]>([]);
  const [created, setCreated] = useState<{
    url: string;
    hours: number;
    scopes: ShareScope[];
  } | null>(null);
  const { data: shareLinks = [] } = useShareLinks();
  // A link turned off (or expired) in Profile must not keep showing here as active.
  const shareUrl = created && !isShareUrlDead(shareLinks, created.url) ? created.url : null;

  const durationLabel =
    DURATIONS.find((d) => d.hours === durationHours)?.label ?? '24 hours';
  const createdDurationLabel =
    DURATIONS.find((d) => d.hours === created?.hours)?.label ?? '24 hours';

  const toggleScope = (scope: ShareScope) =>
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );

  const filteredEntries = timeline.filter((e) =>
    filter === 'all' ? true : e.kind === filter
  );

  const handleGenerateShare = async () => {
    try {
      const res = await createShareMutation.mutateAsync({
        kind: 'timeline',
        ttl_hours: durationHours,
        scopes: selectedScopes,
      });
      const fullUrl = res.url || `${baseUrl}/share/${res.token}`;
      setCreated({ url: fullUrl, hours: durationHours, scopes: selectedScopes });
      setShareOpen(true);
      showToast(`${durationLabel} doctor share link created`, 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not create share link',
        'error'
      );
    }
  };

  const handleCopyShare = async () => {
    if (!shareUrl) return;
    try {
      await Clipboard.setStringAsync(shareUrl);
      showToast('Link copied for your doctor', 'success');
    } catch {
      showToast('Could not copy the link', 'error');
    }
  };

  const handleOpenShare = () => {
    if (!shareUrl) return;
    Linking.openURL(shareUrl).catch(() => {
      showToast('Could not open browser', 'error');
    });
  };

  const handleEntryPress = useCallback(
    (entry: TimelineEntry) => {
      if (entry.kind === 'prescription') {
        router.push(`/prescriptions/${entry.id}`);
      } else if (entry.kind === 'report') {
        router.push(`/reports/${entry.id}`);
      } else if (entry.kind === 'condition') {
        router.push(`/care/${entry.id}`);
      } else if (entry.kind === 'appointment') {
        router.push('/appointments');
      }
    },
    [router]
  );

  const renderItem = useCallback(
    ({ item }: { item: TimelineEntry }) => (
      <TimelineItem item={item} onPress={handleEntryPress} />
    ),
    [handleEntryPress]
  );

  return (
    <Screen title="Timeline" eyebrow="Health" scroll={false}>
      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => `${item.kind}:${item.id}`}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={11}
        initialNumToRender={10}
        ListHeaderComponent={
          <View style={styles.headerStack}>
            {/* Share with doctor */}
            <Card>
              <CardHeader title="Share with doctor" />
              <Text variant="subhead" tone="secondary">
                Create an expiring link and QR code for a doctor. Choose how long
                it lasts and which parts of your record it includes.
              </Text>
              <Text variant="footnote" tone="tertiary" style={styles.shareGroupLabel}>
                Link lasts
              </Text>
              <View style={styles.chipRow}>
                {DURATIONS.map((d) => {
                  const isSelected = durationHours === d.hours;
                  return (
                    <Pressable
                      key={d.hours}
                      accessibilityRole="button"
                      accessibilityLabel={`Link lasts ${d.label}`}
                      accessibilityState={{ selected: isSelected }}
                      onPress={() => setDurationHours(d.hours)}
                      style={[styles.filterChip, isSelected && styles.filterChipActive]}
                    >
                      <Text
                        variant="footnote"
                        tone={isSelected ? 'white' : 'secondary'}
                        style={styles.filterChipText}
                      >
                        {d.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Text variant="footnote" tone="tertiary" style={styles.shareGroupLabel}>
                Include in the shared record
              </Text>
              <View>
                {SCOPE_OPTIONS.map((o) => {
                  const isOn = selectedScopes.includes(o.scope);
                  return (
                    <Pressable
                      key={o.scope}
                      accessibilityRole="switch"
                      accessibilityLabel={`Include ${o.label}`}
                      accessibilityState={{ checked: isOn }}
                      onPress={() => toggleScope(o.scope)}
                      style={styles.scopeRow}
                    >
                      <Text variant="subhead">{o.label}</Text>
                      <Text variant="footnote" tone={isOn ? 'accent' : 'tertiary'} style={styles.filterChipText}>
                        {isOn ? 'Included' : 'Off'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {selectedScopes.length === 0 ? (
                <Text variant="footnote" tone="tertiary">
                  With nothing selected, the link shows your basic timeline without
                  the summary sections.
                </Text>
              ) : null}
              <Button
                title={createShareMutation.isPending ? 'Generating…' : `Share for ${durationLabel}`}
                onPress={handleGenerateShare}
                loading={createShareMutation.isPending}
                disabled={createShareMutation.isPending}
                icon={<Symbol ios="square.and.arrow.up" android="share" size={18} color={T.color.white} />}
              />
            </Card>

            {/* Active share link */}
            {shareOpen && shareUrl ? (
              <Card>
                <View style={styles.shareHeader}>
                  <Text variant="headline">Doctor share link active</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Dismiss share view"
                    onPress={() => setShareOpen(false)}
                    style={styles.dismissBtn}
                  >
                    <Symbol ios="xmark" android="close" size={18} color={T.color.label2} label="Dismiss share view" />
                  </Pressable>
                </View>
                <Pill text={`Expires in ${createdDurationLabel}`} tone="warn" />
                <Text variant="footnote" tone="secondary">
                  {created && created.scopes.length > 0
                    ? `Includes: ${created.scopes.map(shareScopeLabel).join(' · ')}`
                    : 'Basic timeline — no summary sections included.'}
                </Text>
                <View style={styles.qrCenter}>
                  <MobileQrGrid
                    data={shareUrl}
                    size={200}
                    label="Doctor Timeline Share QR"
                  />
                </View>
                <Text variant="footnote" tone="accent" numberOfLines={2}>
                  {shareUrl}
                </Text>
                <View style={styles.shareBtnRow}>
                  <Button title="Copy link" variant="secondary" onPress={handleCopyShare} />
                  <Button title="Open web view" variant="plain" onPress={handleOpenShare} />
                </View>
              </Card>
            ) : null}

            {/* Filters */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
            >
              {FILTERS.map((f) => {
                const isSelected = filter === f;
                return (
                  <Pressable
                    key={f}
                    accessibilityRole="button"
                    accessibilityLabel={`Filter: ${filterLabel(f)}`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setFilter(f)}
                    style={[
                      styles.filterChip,
                      isSelected && styles.filterChipActive,
                    ]}
                  >
                    <Text
                      variant="footnote"
                      tone={isSelected ? 'white' : 'secondary'}
                      style={styles.filterChipText}
                    >
                      {filterLabel(f)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="small" color={T.color.accent} />
              <Text variant="subhead" tone="secondary">
                Building your timeline…
              </Text>
            </View>
          ) : timelineError ? (
            <ErrorState onRetry={() => refetchTimeline()} />
          ) : (
            <EmptyState
              ios="calendar"
              android="calendar_month"
              title="No timeline events yet"
              body="Your prescriptions, lab reports and doctor visits will appear here in chronological order."
            />
          )
        }
        ListFooterComponent={<MobileDisclaimerFooter />}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  listContent: { gap: T.space.lg, paddingBottom: T.space.xl },
  headerStack: { gap: T.space.lg },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: T.space.xs,
    marginTop: T.space.xs,
  },
  detailsText: { fontWeight: '600' },
  shareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dismissBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrCenter: { alignItems: 'center' },
  shareBtnRow: { flexDirection: 'row', gap: T.space.sm },
  filterRow: { gap: T.space.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: T.space.sm },
  shareGroupLabel: { fontWeight: '700', marginTop: T.space.sm },
  scopeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
    paddingVertical: T.space.xs,
  },
  filterChip: {
    backgroundColor: T.color.surface,
    borderWidth: 1,
    borderColor: T.color.separator,
    borderRadius: T.radius.pill,
    paddingHorizontal: T.space.lg,
    minHeight: 44,
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: T.color.accent,
    borderColor: T.color.accent,
  },
  filterChipText: { fontWeight: '600' },
  loadingBox: {
    padding: T.space.xl,
    alignItems: 'center',
    gap: T.space.sm,
  },
});
