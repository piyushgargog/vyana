import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  PriceQuote,
  SourceStatus,
  useCompareLabTest,
  useLabsJob,
  useMyProfile,
} from '@vyana/shared';
import { useVyanaMobile } from '@/components/providers';
import {
  MobileAiSafetyBanner,
  MobileDisclaimerFooter,
} from '@/components/ui-primitives';

const POPULAR_TESTS = [
  'HbA1c',
  'Lipid Profile',
  'Complete Blood Count (CBC)',
  'Thyroid Profile (T3, T4, TSH)',
  'Liver Function Test (LFT)',
  'Kidney Function Test (KFT)',
  'Vitamin D3',
];

const CITIES = ['Delhi', 'Gurgaon', 'Noida', 'Mumbai', 'Bengaluru'];

const LAB_LABELS: Record<string, string> = {
  healthians: 'Healthians',
  redcliffe: 'Redcliffe Labs',
  thyrocare: 'Thyrocare',
  '1mg_labs': 'Tata 1mg Labs',
};

export default function LabsCompareScreen() {
  const router = useRouter();
  const { showToast } = useVyanaMobile();

  // A report's follow-up test can open this screen with ?test_name=...; otherwise nothing is searched until the user taps Search.
  const { test_name: testFromLink } = useLocalSearchParams<{ test_name?: string }>();
  const { data: profile } = useMyProfile();
  const [testName, setTestName] = useState(testFromLink ?? '');
  // No city is chosen for the user: it is theirs from the profile, or they pick one.
  const [cityChoice, setCityChoice] = useState<string | null>(null);
  const city = cityChoice ?? profile?.city?.trim() ?? '';

  const compareMutation = useCompareLabTest();
  const jobId = compareMutation.data?.job_id;

  const { data: jobData } = useLabsJob(jobId);

  const currentResult = jobData ?? compareMutation.data;
  const isRunning =
    compareMutation.isPending || (currentResult && currentResult.status === 'running');

  // Only a test the user came here for starts a search by itself (once). An agent run costs money, so the
  // screen never searches for a test nobody asked for.
  const autoStarted = useRef(false);
  const { mutate: compareLab } = compareMutation;
  useEffect(() => {
    if (autoStarted.current || !testFromLink || !city) return;
    autoStarted.current = true;
    compareLab(
      { test_name: testFromLink, city },
      { onError: (err) => showToast(err.message || 'Could not fetch lab prices', 'error') }
    );
  }, [testFromLink, city, compareLab, showToast]);

  const handleSearch = () => {
    const trimmed = testName.trim();
    if (!trimmed) {
      showToast('Please enter a test name', 'warning');
      return;
    }
    if (!city) {
      showToast('Choose your city first', 'warning');
      return;
    }
    compareMutation.mutate(
      { test_name: trimmed, city },
      {
        onError: (err) => {
          showToast(err.message || 'Could not fetch lab prices', 'error');
        },
      }
    );
  };

  const handleSelectPreset = (preset: string) => {
    setTestName(preset);
    if (!city) {
      showToast('Choose your city, then tap Search', 'info');
      return;
    }
    compareMutation.mutate(
      { test_name: preset, city },
      {
        onError: (err) => {
          showToast(err.message || 'Could not fetch lab prices', 'error');
        },
      }
    );
  };

  const handleOpenLab = (url: string | null | undefined, labName: string) => {
    if (!url) {
      showToast(`No online booking page available for ${labName}`, 'info');
      return;
    }
    Linking.openURL(url).catch(() => {
      showToast(`Could not open booking page for ${labName}`, 'error');
    });
  };

  const quotes = useMemo(() => {
    if (!currentResult?.quotes) return [];
    return [...currentResult.quotes].sort((a, b) => {
      // Confirmed prices first
      if (a.price_verified && !b.price_verified) return -1;
      if (!a.price_verified && b.price_verified) return 1;
      return (a.price ?? Infinity) - (b.price ?? Infinity);
    });
  }, [currentResult]);

  const cheapestQuote = currentResult?.cheapest;
  const sources = currentResult?.sources ?? [];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Compare Diagnostic Labs</Text>
          <Text style={styles.sub}>
            Live home-sample collection prices across Healthians, Redcliffe, Thyrocare & 1mg Labs
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => router.back()}
          style={styles.backBtn}
        >
          <Text style={styles.backBtnText}>✕ Close</Text>
        </Pressable>
      </View>

      <MobileAiSafetyBanner />

      {/* Search & City Filter Card */}
      <View style={styles.searchCard}>
        <Text style={styles.cardSectionLabel}>Select or Enter Lab Test</Text>
        <View style={styles.searchRow}>
          <TextInput
            accessibilityLabel="Lab test name"
            placeholder="e.g. HbA1c, Vitamin D, Lipid Profile"
            placeholderTextColor="#94A3B8"
            value={testName}
            onChangeText={setTestName}
            style={styles.input}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Search lab prices"
            disabled={isRunning}
            onPress={handleSearch}
            style={[styles.searchBtn, isRunning && styles.btnDisabled]}
          >
            {isRunning ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.searchBtnText}>Search</Text>
            )}
          </Pressable>
        </View>

        {/* City Filter */}
        <View style={styles.filterBlock}>
          <Text style={styles.filterLabel}>City / Location:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
            {CITIES.map((c) => {
              const isSelected = city === c;
              return (
                <Pressable
                  key={c}
                  accessibilityRole="button"
                  accessibilityLabel={`Filter city ${c}`}
                  onPress={() => setCityChoice(c)}
                  style={[styles.cityChip, isSelected && styles.cityChipActive]}
                >
                  <Text style={[styles.cityChipText, isSelected && styles.cityChipTextActive]}>
                    {c}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Popular Presets */}
        <View style={styles.presetsBlock}>
          <Text style={styles.filterLabel}>Common Prescriptions & Annual Tests:</Text>
          <View style={styles.presetWrap}>
            {POPULAR_TESTS.map((preset) => {
              const isSelected = testName.toLowerCase() === preset.toLowerCase();
              return (
                <Pressable
                  key={preset}
                  accessibilityRole="button"
                  accessibilityLabel={`Select test ${preset}`}
                  onPress={() => handleSelectPreset(preset)}
                  style={[styles.presetChip, isSelected && styles.presetChipActive]}
                >
                  <Text style={[styles.presetChipText, isSelected && styles.presetChipTextActive]}>
                    {preset}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Progress & Diagnostics Source Agent Status */}
      {sources.length > 0 && (
        <View style={styles.sourcesCard}>
          <View style={styles.sourcesHeader}>
            <Text style={styles.sourcesTitle}>Where we are checking</Text>
            {isRunning && (
              <View style={styles.agentRunningBadge}>
                <ActivityIndicator size="small" color="#0D9488" />
                <Text style={styles.agentRunningText}>Agents checking live prices…</Text>
              </View>
            )}
          </View>

          <View style={styles.sourceGrid}>
            {sources.map((s: SourceStatus) => {
              const label = LAB_LABELS[s.source] ?? s.source;
              const isPending = s.status === 'pending';
              const isOk = s.status === 'ok';

              return (
                <View key={s.source} style={styles.sourceRow}>
                  <View style={styles.sourceInfo}>
                    <Text style={styles.sourceName}>{label}</Text>
                    <Text style={styles.sourceStatusDetail}>
                      {isPending
                        ? 'Fetching latest rate…'
                        : isOk
                          ? 'Quote received'
                          : s.status === 'timeout'
                            ? 'Provider timeout'
                            : 'Test not listed'}
                    </Text>
                  </View>
                  {isPending ? (
                    <ActivityIndicator size="small" color="#0D9488" />
                  ) : isOk ? (
                    <View style={styles.badgeOk}>
                      <Text style={styles.badgeOkText}>✓ Checked</Text>
                    </View>
                  ) : (
                    <View style={styles.badgeMuted}>
                      <Text style={styles.badgeMutedText}>{s.status}</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Comparison Results */}
      <View style={styles.resultsSection}>
        <View style={styles.resultsHeader}>
          <Text style={styles.resultsTitle}>
            Quotes for &quot;{currentResult?.query ?? testName}&quot;{city ? ` (${city})` : ''}
          </Text>
          <Text style={styles.resultsCount}>
            {quotes.length} {quotes.length === 1 ? 'quote' : 'quotes'} available
          </Text>
        </View>

        {currentResult && quotes.length === 0 && !isRunning && (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No quotes available</Text>
            <Text style={styles.emptySub}>
              We couldn&apos;t find verified quotes for this test name in {city}. Try selecting one
              of the popular tests above or check your spelling.
            </Text>
          </View>
        )}

        {quotes.map((quote: PriceQuote, idx: number) => {
          const isCheapest =
            cheapestQuote &&
            quote.source === cheapestQuote.source &&
            quote.price === cheapestQuote.price &&
            quote.price_verified;
          const isVerified = quote.price_verified === true;
          const labName = LAB_LABELS[quote.source] ?? quote.source;
          const hasDiscount =
            typeof quote.mrp === 'number' &&
            typeof quote.price === 'number' &&
            quote.mrp > quote.price;
          const discountPct =
            hasDiscount && quote.mrp && quote.price
              ? Math.round(((quote.mrp - quote.price) / quote.mrp) * 100)
              : null;

          return (
            <View
              key={`${quote.source}-${idx}`}
              style={[styles.quoteCard, isCheapest && styles.quoteCardCheapest]}
            >
              {isCheapest && (
                <View style={styles.cheapestBanner}>
                  <Text style={styles.cheapestBannerText}>★ LOWEST VERIFIED PRICE</Text>
                </View>
              )}

              <View style={styles.quoteBody}>
                <View style={styles.quoteHeaderRow}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={styles.labTitle}>{labName}</Text>
                    <Text style={styles.productName} numberOfLines={2}>
                      {quote.product_name}
                    </Text>
                  </View>

                  <View style={styles.priceColumn}>
                    {quote.price !== null ? (
                      <Text style={[styles.priceText, isCheapest && styles.priceCheapest]}>
                        ₹{quote.price}
                      </Text>
                    ) : (
                      <Text style={styles.priceUnavailable}>N/A</Text>
                    )}
                    {hasDiscount && (
                      <View style={styles.mrpRow}>
                        <Text style={styles.mrpText}>₹{quote.mrp}</Text>
                        {discountPct && (
                          <Text style={styles.discountText}>{discountPct}% OFF</Text>
                        )}
                      </View>
                    )}
                  </View>
                </View>

                {/* Price Verification Status Badge */}
                <View style={styles.metaRow}>
                  {isVerified ? (
                    <View style={styles.verifiedBadge}>
                      <Text style={styles.verifiedBadgeText}>
                        ✓ Price verified on live portal
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.unverifiedBadge}>
                      <Text style={styles.unverifiedBadgeText}>
                        ⚠️ price not confirmed
                      </Text>
                    </View>
                  )}

                  <Text style={styles.fetchedText}>
                    Fetched {new Date(quote.fetched_at).toLocaleDateString()}
                  </Text>
                </View>

                {/* Booking Action */}
                <View style={styles.quoteActionRow}>
                  <Text style={styles.sampleNote}>🏠 Free home sample collection</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Book test on ${labName}`}
                    onPress={() => handleOpenLab(quote.product_url, labName)}
                    style={[styles.bookBtn, isCheapest && styles.bookBtnCheapest]}
                  >
                    <Text
                      style={[
                        styles.bookBtnText,
                        isCheapest && styles.bookBtnTextCheapest,
                      ]}
                    >
                      Book on {labName} ↗
                    </Text>
                  </Pressable>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      <MobileDisclaimerFooter />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { padding: 16, gap: 14 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  sub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  backBtn: {
    backgroundColor: '#E2E8F0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  backBtnText: { fontSize: 13, fontWeight: '700', color: '#334155' },
  searchCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 12,
  },
  cardSectionLabel: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
  },
  searchBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  btnDisabled: { opacity: 0.6 },
  filterBlock: { gap: 6 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#475569' },
  chipsScroll: { flexDirection: 'row' },
  cityChip: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 8,
  },
  cityChipActive: { backgroundColor: '#0F766E' },
  cityChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  cityChipTextActive: { color: '#FFFFFF' },
  presetsBlock: { gap: 6 },
  presetWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  presetChip: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  presetChipActive: {
    backgroundColor: '#CCFBF1',
    borderColor: '#0D9488',
  },
  presetChipText: { fontSize: 12, color: '#334155' },
  presetChipTextActive: { color: '#0F766E', fontWeight: '700' },
  sourcesCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    gap: 10,
  },
  sourcesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  sourcesTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  agentRunningBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  agentRunningText: { fontSize: 12, color: '#0D9488', fontWeight: '600' },
  sourceGrid: { gap: 8 },
  sourceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  sourceInfo: { gap: 2 },
  sourceName: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  sourceStatusDetail: { fontSize: 11, color: '#64748B' },
  badgeOk: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeOkText: { fontSize: 11, fontWeight: '700', color: '#065F46' },
  badgeMuted: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeMutedText: { fontSize: 11, color: '#64748B' },
  resultsSection: { gap: 12 },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  resultsTitle: { fontSize: 15, fontWeight: '800', color: '#0F172A' },
  resultsCount: { fontSize: 12, color: '#64748B' },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: '#334155' },
  emptySub: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 18 },
  quoteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    overflow: 'hidden',
  },
  quoteCardCheapest: {
    borderColor: '#0D9488',
    borderWidth: 2,
    backgroundColor: '#F0FDFA',
  },
  cheapestBanner: {
    backgroundColor: '#0D9488',
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  cheapestBannerText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  quoteBody: { padding: 14, gap: 10 },
  quoteHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  labTitle: { fontSize: 12, fontWeight: '800', color: '#0F766E', textTransform: 'uppercase' },
  productName: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  priceColumn: { alignItems: 'flex-end', gap: 2 },
  priceText: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  priceCheapest: { color: '#0F766E' },
  priceUnavailable: { fontSize: 14, color: '#94A3B8' },
  mrpRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  mrpText: { fontSize: 11, color: '#94A3B8', textDecorationLine: 'line-through' },
  discountText: { fontSize: 11, color: '#B91C1C', fontWeight: '700' },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  verifiedBadge: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedBadgeText: { fontSize: 11, color: '#065F46', fontWeight: '600' },
  unverifiedBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  unverifiedBadgeText: { fontSize: 11, color: '#92400E', fontWeight: '600' },
  fetchedText: { fontSize: 11, color: '#94A3B8' },
  quoteActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  sampleNote: { fontSize: 11, color: '#475569' },
  bookBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  bookBtnCheapest: { backgroundColor: '#0F766E' },
  bookBtnText: { fontSize: 12, fontWeight: '700', color: '#1E293B' },
  bookBtnTextCheapest: { color: '#FFFFFF' },
});
