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
import {
  useCreateShareLink,
  useTimeline,
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
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const filteredEntries = timeline.filter((e) =>
    filter === 'all' ? true : e.kind === filter
  );

  const handleGenerateShare = async () => {
    try {
      const res = await createShareMutation.mutateAsync({
        kind: 'timeline',
        ttl_hours: 24,
      });
      const fullUrl = res.url || `${baseUrl}/share/${res.token}`;
      setShareUrl(fullUrl);
      setShareOpen(true);
      showToast('24-hour doctor share link created', 'success');
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Could not create share link',
        'error'
      );
    }
  };

  const handleCopyShare = () => {
    if (!shareUrl) return;
    showToast('Link copied for your doctor', 'info');
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
        keyExtractor={(item) => item.id}
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
                Create an expiring 24-hour link and QR code for a doctor to
                review your full history.
              </Text>
              <Button
                title={createShareMutation.isPending ? 'Generating…' : 'Share for 24 hours'}
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
                <Pill text="Expires in 24 hours" tone="warn" />
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
