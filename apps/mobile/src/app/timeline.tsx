import React, { useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
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
  MobileDisclaimerFooter,
  MobileQrGrid,
} from '@/components/ui-primitives';

export default function TimelineScreen() {
  const router = useRouter();
  const { baseUrl, showToast } = useVyanaMobile();

  const { data: timeline = [], isLoading } = useTimeline();
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
      showToast('24-Hour Doctor Share Link created', 'success');
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

  const handleEntryPress = (entry: TimelineEntry) => {
    if (entry.kind === 'prescription') {
      router.push(`/prescriptions/${entry.id}`);
    } else if (entry.kind === 'report') {
      router.push(`/reports/${entry.id}`);
    } else if (entry.kind === 'condition') {
      router.push(`/care/${entry.id}`);
    } else if (entry.kind === 'appointment') {
      router.push('/appointments');
    }
  };

  const getKindBadge = (kind: TimelineKind) => {
    switch (kind) {
      case 'prescription':
        return { label: 'RX', bg: '#F0FDFA', color: '#0F766E' };
      case 'report':
        return { label: 'LAB', bg: '#EFF6FF', color: '#1D4ED8' };
      case 'appointment':
        return { label: 'OPD', bg: '#FEF3C7', color: '#B45309' };
      case 'condition':
        return { label: 'CARE', bg: '#FDF2F8', color: '#BE185D' };
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Header */}
      <View style={styles.topBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Health Timeline</Text>
          <Text style={styles.headerSub}>
            Unified chronological record of care & visits
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>Done</Text>
        </Pressable>
      </View>

      {/* Share with Doctor Card */}
      <View style={styles.shareBanner}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.shareBannerTitle}>Share with Doctor</Text>
          <Text style={styles.shareBannerSub}>
            Create an expiring 24h link & QR for a doctor to review your full history.
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create 24-hour doctor share link and QR"
          disabled={createShareMutation.isPending}
          onPress={handleGenerateShare}
          style={styles.shareActionBtn}
        >
          <Text style={styles.shareActionBtnText}>
            {createShareMutation.isPending ? 'Generating…' : 'Share (24h) →'}
          </Text>
        </Pressable>
      </View>

      {/* Active Share Modal / Drawer */}
      {shareOpen && shareUrl && (
        <View style={styles.shareBox}>
          <View style={styles.shareHeader}>
            <Text style={styles.shareBoxTitle}>Doctor Share Link Active (24h)</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Dismiss share view"
              onPress={() => setShareOpen(false)}
            >
              <Text style={styles.dismissText}>✕</Text>
            </Pressable>
          </View>

          <View style={styles.qrCenter}>
            <MobileQrGrid
              data={shareUrl}
              size={200}
              label="Doctor Timeline Share QR"
            />
            <Text style={styles.qrSub}>Doctor can scan this QR directly</Text>
          </View>

          <Text style={styles.shareUrlText} numberOfLines={2}>
            {shareUrl}
          </Text>

          <View style={styles.shareBtnRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Copy link to clipboard"
              onPress={handleCopyShare}
              style={styles.copyBtn}
            >
              <Text style={styles.copyBtnText}>Copy Link</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open share link in browser"
              onPress={handleOpenShare}
              style={styles.previewBtn}
            >
              <Text style={styles.previewBtnText}>Open Web View ↗</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
      >
        {(
          [
            'all',
            'prescription',
            'report',
            'appointment',
            'condition',
          ] as const
        ).map((f) => {
          const isSelected = filter === f;
          return (
            <Pressable
              key={f}
              accessibilityRole="button"
              accessibilityLabel={`Filter ${f}`}
              onPress={() => setFilter(f)}
              style={[
                styles.filterPill,
                isSelected && styles.filterPillActive,
              ]}
            >
              <Text
                style={[
                  styles.filterPillText,
                  isSelected && styles.filterPillTextActive,
                ]}
              >
                {f === 'all'
                  ? 'All Events'
                  : f === 'prescription'
                    ? 'Prescriptions'
                    : f === 'report'
                      ? 'Lab Reports'
                      : f === 'appointment'
                        ? 'OPD Visits'
                        : 'Care Plans'}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Chronological Timeline List */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#0D9488" />
          <Text style={styles.loadingText}>Building your timeline…</Text>
        </View>
      ) : filteredEntries.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Timeline Events</Text>
          <Text style={styles.emptySub}>
            Your prescriptions, lab reports, and doctor visits will appear here
            in chronological order.
          </Text>
        </View>
      ) : (
        <View style={styles.timelineList}>
          {filteredEntries.map((item, idx) => {
            const badge = getKindBadge(item.kind);
            return (
              <Pressable
                key={`${item.id}-${idx}`}
                accessibilityRole="button"
                accessibilityLabel={`${item.title} on ${item.date}`}
                onPress={() => handleEntryPress(item)}
                style={styles.timelineCard}
              >
                <View style={styles.cardHeader}>
                  <View
                    style={[
                      styles.kindBadge,
                      { backgroundColor: badge.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.kindBadgeText,
                        { color: badge.color },
                      ]}
                    >
                      {badge.label}
                    </Text>
                  </View>
                  <Text style={styles.dateText}>{item.date}</Text>
                </View>

                <Text style={styles.entryTitle}>{item.title}</Text>
                {item.subtitle && (
                  <Text style={styles.entrySub}>{item.subtitle}</Text>
                )}

                <Text style={styles.tapDetailsText}>View details →</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 13, color: '#64748B' },
  backBtn: {
    backgroundColor: '#0F766E',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  backBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  shareBanner: {
    backgroundColor: '#0F766E',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  shareBannerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  shareBannerSub: { fontSize: 12, color: '#CCFBF1', lineHeight: 16 },
  shareActionBtn: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },
  shareActionBtnText: { color: '#0F766E', fontSize: 13, fontWeight: '800' },
  shareBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  shareHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shareBoxTitle: { fontSize: 14, fontWeight: '700', color: '#0F766E' },
  dismissText: { fontSize: 16, color: '#64748B', fontWeight: '700' },
  qrCenter: { alignItems: 'center', gap: 6 },
  qrSub: { fontSize: 12, color: '#64748B' },
  shareUrlText: {
    fontSize: 11,
    color: '#0F766E',
    backgroundColor: '#F0FDFA',
    padding: 8,
    borderRadius: 8,
  },
  shareBtnRow: { flexDirection: 'row', gap: 10 },
  copyBtn: {
    flex: 1,
    backgroundColor: '#0F766E',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  copyBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  previewBtn: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  previewBtnText: { color: '#0F172A', fontSize: 13, fontWeight: '600' },
  filterRow: { gap: 8, paddingBottom: 4 },
  filterPill: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  filterPillActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  filterPillText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  filterPillTextActive: { color: '#FFFFFF' },
  loadingBox: { padding: 24, alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 13, color: '#64748B' },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  emptySub: { fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18 },
  timelineList: { gap: 12 },
  timelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kindBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  kindBadgeText: { fontSize: 10, fontWeight: '800' },
  dateText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  entryTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  entrySub: { fontSize: 13, color: '#475569', lineHeight: 18 },
  tapDetailsText: {
    fontSize: 12,
    color: '#0D9488',
    fontWeight: '600',
    marginTop: 4,
  },
});
